import type { Prisma } from '@prisma/client';
import type { AuctionStatus } from '@ecosoft/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { auctionAccessWhere, assertInstitutionalAuctionAccess } from './auction-access';
import { replaceSystemCalendarEvents } from './auction-calendar.service';
import { assertAuctionTransition, editableAuctionStatuses } from './auction-state';
import { auctionRealtime } from './auction-realtime';
import {
  auctionCreateSchema,
  auctionQuerySchema,
  auctionStatusSchema,
  auctionUpdateSchema,
  participantListSchema,
  requirementListSchema,
} from './auctions.schemas';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});

const auctionSelect = {
  id: true,
  code: true,
  title: true,
  description: true,
  status: true,
  renewableTechnologyCode: true,
  currencyCode: true,
  capacityMw: true,
  maximumPrice: true,
  timezone: true,
  openAt: true,
  closeAt: true,
  evaluationStartAt: true,
  awardPlannedAt: true,
  publishedAt: true,
  closedAt: true,
  cancelledAt: true,
  finalizedAt: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
  managingOrganization: { select: { id: true, legalName: true, commercialName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  requirements: { orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] },
  participants: {
    orderBy: { organization: { legalName: 'asc' } },
    select: {
      id: true,
      status: true,
      notes: true,
      createdAt: true,
      organization: {
        select: { id: true, rnc: true, legalName: true, commercialName: true, type: true },
      },
    },
  },
  _count: { select: { requirements: true, participants: true, events: true } },
} satisfies Prisma.AuctionSelect;

const getAuction = async (id: string, request: Request) => {
  const auction = await prisma.auction.findFirst({
    where: { id, AND: [auctionAccessWhere(request.auth!)] },
    select: auctionSelect,
  });
  if (!auction)
    throw new AppError(404, 'AUCTION_NOT_FOUND', 'La subasta no existe o no es visible.');
  return auction;
};

const validateCatalogCodes = async (technology: string, currency: string) => {
  const count = await prisma.catalogItem.count({
    where: {
      isActive: true,
      OR: [
        { type: 'ENERGY_TECHNOLOGY', code: technology },
        { type: 'CURRENCY', code: currency },
      ],
    },
  });
  if (count !== 2) {
    throw new AppError(
      400,
      'INVALID_AUCTION_CATALOG',
      'La tecnología renovable o la moneda no pertenece a un catálogo activo.',
    );
  }
};

router.get(
  '/',
  authenticate,
  requirePermission(permissions.auctionsRead),
  asyncHandler(async (request, response) => {
    const query = auctionQuerySchema.parse(request.query);
    const where: Prisma.AuctionWhereInput = {
      AND: [
        auctionAccessWhere(request.auth!),
        query.q ? { OR: [{ code: { contains: query.q } }, { title: { contains: query.q } }] } : {},
        query.status ? { status: query.status } : {},
        query.technology ? { renewableTechnologyCode: query.technology } : {},
      ],
    };
    const [auctions, total] = await prisma.$transaction([
      prisma.auction.findMany({
        where,
        select: auctionSelect,
        orderBy: [{ openAt: 'desc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.auction.count({ where }),
    ]);
    response.json({
      data: auctions,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  }),
);

router.get(
  '/:id',
  authenticate,
  requirePermission(permissions.auctionsRead),
  asyncHandler(async (request, response) => {
    response.json({ data: await getAuction(parseId(request.params.id), request) });
  }),
);

router.post(
  '/',
  authenticate,
  requirePermission(permissions.auctionsCreate),
  asyncHandler(async (request, response) => {
    assertInstitutionalAuctionAccess(request.auth!);
    const input = auctionCreateSchema.parse(request.body);
    await validateCatalogCodes(input.renewableTechnologyCode, input.currencyCode);
    const manager = await prisma.organization.findUnique({
      where: { id: input.managingOrganizationId },
      select: { id: true, status: true, type: true },
    });
    if (!manager || manager.status !== 'APPROVED' || manager.type !== 'REGULATORY_AUTHORITY') {
      throw new AppError(
        409,
        'INVALID_AUCTION_MANAGER',
        'La subasta debe ser administrada por una autoridad reguladora aprobada.',
      );
    }
    if (await prisma.auction.findUnique({ where: { code: input.code }, select: { id: true } })) {
      throw new AppError(409, 'AUCTION_CODE_EXISTS', 'Ya existe una subasta con este código.');
    }
    const auction = await prisma.$transaction(async (transaction) => {
      const created = await transaction.auction.create({
        data: { ...input, createdByUserId: request.auth!.id },
      });
      await transaction.auctionEvent.create({
        data: {
          auctionId: created.id,
          createdByUserId: request.auth!.id,
          type: 'CREATED',
          newStatus: 'BORRADOR',
          message: 'Subasta creada en estado borrador.',
        },
      });
      await replaceSystemCalendarEvents(transaction, created);
      return created;
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: auction.managingOrganizationId,
      action: 'CREATE',
      module: 'AUCTIONS',
      entity: 'Auction',
      entityId: auction.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: input,
    });
    response.status(201).json({ data: await getAuction(auction.id, request) });
  }),
);

router.patch(
  '/:id',
  authenticate,
  requirePermission(permissions.auctionsUpdate),
  asyncHandler(async (request, response) => {
    assertInstitutionalAuctionAccess(request.auth!);
    const id = parseId(request.params.id);
    const previous = await getAuction(id, request);
    if (!editableAuctionStatuses.includes(previous.status as AuctionStatus)) {
      throw new AppError(409, 'AUCTION_NOT_EDITABLE', 'La subasta ya no admite edición general.');
    }
    const input = auctionUpdateSchema.parse(request.body);
    if (Object.keys(input).length === 0) {
      throw new AppError(400, 'EMPTY_UPDATE', 'Debe indicar al menos un campo para actualizar.');
    }
    const technology = input.renewableTechnologyCode ?? previous.renewableTechnologyCode;
    const currency = input.currencyCode ?? previous.currencyCode;
    await validateCatalogCodes(technology, currency);
    if (input.code && input.code !== previous.code) {
      const existingCode = await prisma.auction.findUnique({
        where: { code: input.code },
        select: { id: true },
      });
      if (existingCode) {
        throw new AppError(409, 'AUCTION_CODE_EXISTS', 'Ya existe una subasta con este código.');
      }
    }
    if (input.managingOrganizationId) {
      const manager = await prisma.organization.findUnique({
        where: { id: input.managingOrganizationId },
        select: { status: true, type: true },
      });
      if (!manager || manager.status !== 'APPROVED' || manager.type !== 'REGULATORY_AUTHORITY') {
        throw new AppError(
          409,
          'INVALID_AUCTION_MANAGER',
          'La subasta debe ser administrada por una autoridad reguladora aprobada.',
        );
      }
    }
    const openAt = input.openAt ?? previous.openAt;
    const closeAt = input.closeAt ?? previous.closeAt;
    const evaluationStartAt =
      input.evaluationStartAt === undefined ? previous.evaluationStartAt : input.evaluationStartAt;
    const awardPlannedAt =
      input.awardPlannedAt === undefined ? previous.awardPlannedAt : input.awardPlannedAt;
    if (
      closeAt <= openAt ||
      (evaluationStartAt && evaluationStartAt < closeAt) ||
      (awardPlannedAt && evaluationStartAt && awardPlannedAt < evaluationStartAt)
    ) {
      throw new AppError(400, 'INVALID_AUCTION_DATES', 'El cronograma de la subasta no es válido.');
    }
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.auction.update({ where: { id }, data: input });
      await transaction.auctionEvent.create({
        data: {
          auctionId: id,
          createdByUserId: request.auth!.id,
          type: 'UPDATED',
          message: 'Configuración general de la subasta actualizada.',
          metadataJson: JSON.stringify(input),
        },
      });
      await replaceSystemCalendarEvents(transaction, updated);
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: previous.managingOrganization.id,
      action: 'UPDATE',
      module: 'AUCTIONS',
      entity: 'Auction',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: previous,
      newValues: input,
    });
    response.json({ data: await getAuction(id, request) });
  }),
);

router.put(
  '/:id/requirements',
  authenticate,
  requirePermission(permissions.auctionsUpdate),
  asyncHandler(async (request, response) => {
    assertInstitutionalAuctionAccess(request.auth!);
    const id = parseId(request.params.id);
    const auction = await getAuction(id, request);
    if (!['BORRADOR', 'PROGRAMADA', 'PUBLICADA'].includes(auction.status)) {
      throw new AppError(409, 'REQUIREMENTS_LOCKED', 'Los requisitos ya están bloqueados.');
    }
    const { requirements } = requirementListSchema.parse(request.body);
    if (new Set(requirements.map((item) => item.code)).size !== requirements.length) {
      throw new AppError(
        400,
        'DUPLICATE_REQUIREMENT',
        'Los códigos de requisito no pueden repetirse.',
      );
    }
    await prisma.$transaction([
      prisma.auctionRequirement.deleteMany({ where: { auctionId: id } }),
      prisma.auctionRequirement.createMany({
        data: requirements.map((item) => ({ ...item, auctionId: id })),
      }),
      prisma.auctionEvent.create({
        data: {
          auctionId: id,
          createdByUserId: request.auth!.id,
          type: 'REQUIREMENTS_UPDATED',
          message: `${requirements.length} requisitos configurados.`,
        },
      }),
    ]);
    await auditService.record({
      userId: request.auth!.id,
      organizationId: auction.managingOrganization.id,
      action: 'UPDATE_REQUIREMENTS',
      module: 'AUCTIONS',
      entity: 'Auction',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: { requirements },
    });
    response.json({ data: await getAuction(id, request) });
  }),
);

router.put(
  '/:id/participants',
  authenticate,
  requirePermission(permissions.auctionsUpdate),
  asyncHandler(async (request, response) => {
    assertInstitutionalAuctionAccess(request.auth!);
    const id = parseId(request.params.id);
    const auction = await getAuction(id, request);
    if (!['BORRADOR', 'PROGRAMADA', 'PUBLICADA'].includes(auction.status)) {
      throw new AppError(409, 'PARTICIPANTS_LOCKED', 'Los participantes ya están bloqueados.');
    }
    const { participants } = participantListSchema.parse(request.body);
    const ids = participants.map((item) => item.organizationId);
    if (new Set(ids).size !== ids.length) {
      throw new AppError(400, 'DUPLICATE_PARTICIPANT', 'Una organización no puede repetirse.');
    }
    const approved = await prisma.organization.count({
      where: { id: { in: ids }, status: 'APPROVED', type: { not: 'REGULATORY_AUTHORITY' } },
    });
    if (approved !== ids.length) {
      throw new AppError(
        409,
        'INVALID_AUCTION_PARTICIPANT',
        'Todos los participantes deben ser organizaciones aprobadas y no reguladoras.',
      );
    }
    await prisma.$transaction([
      prisma.auctionParticipant.deleteMany({ where: { auctionId: id } }),
      prisma.auctionParticipant.createMany({
        data: participants.map((item) => ({ ...item, auctionId: id })),
      }),
      prisma.auctionEvent.create({
        data: {
          auctionId: id,
          createdByUserId: request.auth!.id,
          type: 'PARTICIPANTS_UPDATED',
          message: `${participants.length} participantes configurados.`,
        },
      }),
    ]);
    await auditService.record({
      userId: request.auth!.id,
      organizationId: auction.managingOrganization.id,
      action: 'UPDATE_PARTICIPANTS',
      module: 'AUCTIONS',
      entity: 'Auction',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: { participants },
    });
    response.json({ data: await getAuction(id, request) });
  }),
);

router.patch(
  '/:id/status',
  authenticate,
  requirePermission(permissions.auctionsPublish),
  asyncHandler(async (request, response) => {
    assertInstitutionalAuctionAccess(request.auth!);
    const id = parseId(request.params.id);
    const input = auctionStatusSchema.parse(request.body);
    const auction = await getAuction(id, request);
    assertAuctionTransition(auction.status as AuctionStatus, input.status);
    if (input.status === 'CANCELADA' && !input.reason) {
      throw new AppError(400, 'CANCELLATION_REASON_REQUIRED', 'Debe justificar la cancelación.');
    }
    if (input.status === 'PUBLICADA') {
      const enabledParticipants = await prisma.auctionParticipant.count({
        where: { auctionId: id, status: 'HABILITADO' },
      });
      if (auction._count.requirements === 0 || enabledParticipants === 0 || !auction.maximumPrice) {
        throw new AppError(
          409,
          'AUCTION_NOT_READY',
          'Configure precio máximo, requisitos y participantes antes de publicar.',
        );
      }
    }
    const now = new Date();
    if (input.status === 'ABIERTA' && now < auction.openAt) {
      throw new AppError(409, 'AUCTION_TOO_EARLY', 'La fecha de apertura aún no ha llegado.');
    }
    if (input.status === 'CERRADA' && now < auction.closeAt) {
      throw new AppError(409, 'AUCTION_CLOSE_TOO_EARLY', 'La fecha de cierre aún no ha llegado.');
    }
    const timestamps: Prisma.AuctionUpdateInput =
      input.status === 'PUBLICADA'
        ? { publishedAt: now }
        : input.status === 'CERRADA'
          ? { closedAt: now }
          : input.status === 'CANCELADA'
            ? { cancelledAt: now, cancellationReason: input.reason }
            : input.status === 'FINALIZADA'
              ? { finalizedAt: now }
              : {};
    await prisma.$transaction(async (transaction) => {
      const changed = await transaction.auction.updateMany({
        where: { id, status: auction.status },
        data: { status: input.status, ...timestamps },
      });
      if (changed.count !== 1) {
        throw new AppError(
          409,
          'AUCTION_CONCURRENT_CHANGE',
          'La subasta cambió mientras se procesaba la solicitud. Actualice e intente nuevamente.',
        );
      }
      await transaction.auctionEvent.create({
        data: {
          auctionId: id,
          createdByUserId: request.auth!.id,
          type: 'STATUS_CHANGED',
          previousStatus: auction.status,
          newStatus: input.status,
          message: input.reason,
        },
      });
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: auction.managingOrganization.id,
      action: input.status === 'PUBLICADA' ? 'PUBLISH' : 'STATUS_CHANGE',
      module: 'AUCTIONS',
      entity: 'Auction',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: { status: auction.status },
      newValues: input,
    });
    await auctionRealtime.publish({
      auctionId: id,
      code: auction.code,
      type: 'STATUS_CHANGED',
      previousStatus: auction.status as AuctionStatus,
      newStatus: input.status,
      occurredAt: now.toISOString(),
    });
    response.json({ data: await getAuction(id, request) });
  }),
);

router.get(
  '/:id/events',
  authenticate,
  requirePermission(permissions.auctionsRead),
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    await getAuction(id, request);
    const events = await prisma.auctionEvent.findMany({
      where: { auctionId: id },
      select: {
        id: true,
        type: true,
        previousStatus: true,
        newStatus: true,
        message: true,
        createdAt: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    response.json({ data: events });
  }),
);

export { router as auctionsRouter };
