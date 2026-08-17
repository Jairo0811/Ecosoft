import type { Prisma } from '@prisma/client';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { auditQuerySchema } from './audit.schemas';
import { auditService } from './audit.service';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});

const auditSelect = {
  id: true,
  userId: true,
  organizationId: true,
  action: true,
  module: true,
  entity: true,
  entityId: true,
  result: true,
  ipAddress: true,
  userAgent: true,
  correlationId: true,
  previousValues: true,
  newValues: true,
  eventHash: true,
  createdAt: true,
  user: { select: { email: true, firstName: true, lastName: true } },
} satisfies Prisma.AuditLogSelect;

router.get(
  '/',
  authenticate,
  requirePermission(permissions.auditRead),
  asyncHandler(async (request, response) => {
    const query = auditQuerySchema.parse(request.query);
    const correlationId = query.q ? z.uuid().safeParse(query.q) : undefined;
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.module ? { module: query.module } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { action: { contains: query.q } },
              { module: { contains: query.q } },
              { entity: { contains: query.q } },
              { entityId: { contains: query.q } },
              ...(correlationId?.success ? [{ correlationId: correlationId.data }] : []),
            ],
          }
        : {}),
    };
    const [events, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: auditSelect,
      }),
      prisma.auditLog.count({ where }),
    ]);
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'READ_SENSITIVE',
      module: 'AUDIT',
      entity: 'AuditLog',
      result: 'SUCCESS',
      ...metadata(request),
      newValues: { filters: query, returned: events.length },
    });
    response.json({
      data: events,
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
  requirePermission(permissions.auditRead),
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const event = await prisma.auditLog.findUnique({ where: { id }, select: auditSelect });
    if (!event) throw new AppError(404, 'AUDIT_EVENT_NOT_FOUND', 'El evento no existe.');
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'READ_SENSITIVE',
      module: 'AUDIT',
      entity: 'AuditLog',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
    });
    response.json({ data: event });
  }),
);

export { router as auditRouter };
