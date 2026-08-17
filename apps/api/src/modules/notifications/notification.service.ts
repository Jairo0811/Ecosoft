import type { SessionUser } from '@ecosoft/shared';
import { prisma } from '../../config/prisma';
import { hasInstitutionalAnalyticsAccess } from '../analytics/analytics-access';
import {
  emailNotificationPublisher,
  realtimeNotificationPublisher,
  type NotificationDeliveryEvent,
} from './notification-delivery';

interface NotificationInput {
  userId: string;
  organizationId?: string;
  sourceKey: string;
  type: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  expiresAt?: Date;
}

const createIfMissing = async (input: NotificationInput): Promise<void> => {
  const existing = await prisma.notification.findUnique({
    where: { userId_sourceKey: { userId: input.userId, sourceKey: input.sourceKey } },
    select: { id: true },
  });
  if (existing) return;
  let created;
  try {
    created = await prisma.notification.create({ data: input });
  } catch (error) {
    // Dos lecturas simultáneas pueden intentar materializar la misma alerta.
    // Si la otra petición ganó la restricción única, la alerta ya está entregada.
    const raced = await prisma.notification.findUnique({
      where: { userId_sourceKey: { userId: input.userId, sourceKey: input.sourceKey } },
      select: { id: true },
    });
    if (raced) return;
    throw error;
  }
  const event: NotificationDeliveryEvent = {
    notificationId: created.id,
    userId: created.userId,
    type: created.type,
    title: created.title,
    message: created.message,
    actionUrl: created.actionUrl ?? undefined,
  };
  await Promise.all([
    realtimeNotificationPublisher.publish(event),
    emailNotificationPublisher.publish(event),
  ]);
};

const usersWithPermission = async (permission: string) =>
  prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      roles: { some: { role: { permissions: { some: { permission: { code: permission } } } } } },
    },
    select: { id: true, organizationId: true },
  });

const refreshForUser = async (actor: SessionUser): Promise<void> => {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const inNinetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const institutional = hasInstitutionalAnalyticsAccess(actor);
  const organizationId = actor.organizationId ?? undefined;
  if (!institutional && !organizationId) return;
  const auctions = await prisma.auction.findMany({
    where: {
      status: { in: ['PUBLICADA', 'ABIERTA'] },
      closeAt: { gte: now, lte: inSevenDays },
      ...(!institutional && organizationId
        ? { participants: { some: { organizationId, status: 'HABILITADO' } } }
        : {}),
    },
    select: { id: true, code: true, title: true, closeAt: true },
    take: 50,
  });
  const contracts = await prisma.pPAContract.findMany({
    where: {
      status: 'VIGENTE',
      endDate: { gte: now, lte: inNinetyDays },
      ...(!institutional && organizationId ? { organizationId } : {}),
    },
    select: { id: true, contractNumber: true, endDate: true, organizationId: true },
    take: 50,
  });
  await Promise.all([
    ...auctions.map((auction) =>
      createIfMissing({
        userId: actor.id,
        organizationId,
        sourceKey: `AUCTION_CLOSE:${auction.id}:${auction.closeAt.toISOString()}`,
        type: 'AUCTION_CLOSING',
        severity:
          auction.closeAt.getTime() - now.getTime() <= 48 * 60 * 60 * 1000 ? 'CRITICAL' : 'WARNING',
        title: `Cierre próximo: ${auction.code}`,
        message: `${auction.title} cierra el ${auction.closeAt.toISOString()}.`,
        entityType: 'Auction',
        entityId: auction.id,
        actionUrl: '/subastas',
        expiresAt: auction.closeAt,
      }),
    ),
    ...contracts.map((contract) =>
      createIfMissing({
        userId: actor.id,
        organizationId: contract.organizationId,
        sourceKey: `CONTRACT_EXPIRY:${contract.id}:${contract.endDate.toISOString()}`,
        type: 'CONTRACT_EXPIRING',
        severity: 'WARNING',
        title: `Contrato próximo a vencer: ${contract.contractNumber}`,
        message: `El contrato vence el ${contract.endDate.toISOString()}.`,
        entityType: 'PPAContract',
        entityId: contract.id,
        actionUrl: '/contratos',
        expiresAt: contract.endDate,
      }),
    ),
  ]);
};

const notifyRegulationPublished = async (regulation: {
  id: string;
  code: string;
  title: string;
}): Promise<void> => {
  const users = await usersWithPermission('regulatory.read');
  await Promise.all(
    users.map((user) =>
      createIfMissing({
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        sourceKey: `REGULATION_PUBLISHED:${regulation.id}`,
        type: 'REGULATION_PUBLISHED',
        severity: 'INFO',
        title: `Cambio regulatorio: ${regulation.code}`,
        message: regulation.title,
        entityType: 'Regulation',
        entityId: regulation.id,
        actionUrl: '/regulacion',
      }),
    ),
  );
};

const notifyAuctionStatus = async (auction: {
  id: string;
  code: string;
  title: string;
  status: string;
}): Promise<void> => {
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      roles: {
        some: { role: { permissions: { some: { permission: { code: 'notifications.read' } } } } },
      },
      OR: [
        { organization: { is: { type: 'REGULATORY_AUTHORITY' } } },
        {
          organization: {
            is: {
              auctionParticipations: { some: { auctionId: auction.id, status: 'HABILITADO' } },
            },
          },
        },
      ],
    },
    select: { id: true, organizationId: true },
  });
  const labels: Record<string, string> = {
    PUBLICADA: 'Nueva licitación publicada',
    ABIERTA: 'Subasta abierta',
    CERRADA: 'Subasta cerrada',
    ADJUDICADA: 'Subasta adjudicada',
  };
  if (!labels[auction.status]) return;
  await Promise.all(
    users.map((user) =>
      createIfMissing({
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        sourceKey: `AUCTION_STATUS:${auction.id}:${auction.status}`,
        type: `AUCTION_${auction.status}`,
        severity: auction.status === 'CERRADA' ? 'WARNING' : 'INFO',
        title: `${labels[auction.status]}: ${auction.code}`,
        message: auction.title,
        entityType: 'Auction',
        entityId: auction.id,
        actionUrl: '/subastas',
      }),
    ),
  );
};

export const notificationService = {
  refreshForUser,
  notifyRegulationPublished,
  notifyAuctionStatus,
};
