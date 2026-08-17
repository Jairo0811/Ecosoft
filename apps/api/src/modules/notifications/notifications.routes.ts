import type { Prisma } from '@prisma/client';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission, requireTrustedWebRequest } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { notificationService } from './notification.service';
import { notificationQuerySchema } from './notifications.schemas';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});

router.get(
  '/',
  authenticate,
  requirePermission(permissions.notificationsRead),
  asyncHandler(async (request, response) => {
    const query = notificationQuerySchema.parse(request.query);
    await notificationService.refreshForUser(request.auth!);
    const where: Prisma.NotificationWhereInput = {
      userId: request.auth!.id,
      ...(query.unread === undefined
        ? {}
        : query.unread
          ? { readAt: null }
          : { readAt: { not: null } }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
    };
    const [notifications, total, unread] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: request.auth!.id, readAt: null } }),
    ]);
    response.json({
      data: notifications,
      unread,
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
  '/unread-count',
  authenticate,
  requirePermission(permissions.notificationsRead),
  asyncHandler(async (request, response) => {
    await notificationService.refreshForUser(request.auth!);
    const unread = await prisma.notification.count({
      where: { userId: request.auth!.id, readAt: null },
    });
    response.json({ data: { unread } });
  }),
);

router.patch(
  '/:id/read',
  authenticate,
  requirePermission(permissions.notificationsRead),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const notification = await prisma.notification.findFirst({
      where: { id, userId: request.auth!.id },
    });
    if (!notification) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'La notificación no existe.');
    }
    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'UPDATE',
      module: 'NOTIFICATIONS',
      entity: 'Notification',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: { readAt: updated.readAt },
    });
    response.json({ data: updated });
  }),
);

router.post(
  '/read-all',
  authenticate,
  requirePermission(permissions.notificationsRead),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const readAt = new Date();
    const result = await prisma.notification.updateMany({
      where: { userId: request.auth!.id, readAt: null },
      data: { readAt },
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'UPDATE',
      module: 'NOTIFICATIONS',
      entity: 'Notification',
      result: 'SUCCESS',
      ...metadata(request),
      newValues: { markedAsRead: result.count, readAt },
    });
    response.json({ data: { updated: result.count } });
  }),
);

export { router as notificationsRouter };
