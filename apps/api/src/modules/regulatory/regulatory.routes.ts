import type { Prisma } from '@prisma/client';
import type { RegulationScopeType, RegulationStatus } from '@ecosoft/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission, requireTrustedWebRequest } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { notificationService } from '../notifications/notification.service';
import {
  regulationCreateSchema,
  regulationQuerySchema,
  regulationStatusSchema,
  regulationUpdateSchema,
} from './regulatory.schemas';
import { assertRegulationTransition } from './regulatory-state';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});

const regulationSelect = {
  id: true,
  code: true,
  title: true,
  summary: true,
  type: true,
  status: true,
  effectiveFrom: true,
  effectiveTo: true,
  sourceUrl: true,
  documentReference: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  issuingOrganization: {
    select: { id: true, legalName: true, commercialName: true, type: true, status: true },
  },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  scopes: { orderBy: [{ entityType: 'asc' as const }, { createdAt: 'asc' as const }] },
  events: {
    orderBy: { createdAt: 'desc' as const },
    take: 25,
    select: {
      id: true,
      action: true,
      previousStatus: true,
      newStatus: true,
      reason: true,
      createdAt: true,
      changedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  },
} satisfies Prisma.RegulationSelect;

const assertAuthority = async (organizationId: string): Promise<void> => {
  const authority = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { type: true, status: true },
  });
  if (!authority || authority.type !== 'REGULATORY_AUTHORITY' || authority.status !== 'APPROVED') {
    throw new AppError(
      409,
      'INVALID_REGULATORY_AUTHORITY',
      'La entidad emisora debe ser una autoridad reguladora aprobada.',
    );
  }
};

const assertScopeExists = async (type: RegulationScopeType, id: string): Promise<void> => {
  const exists =
    type === 'AUCTION'
      ? await prisma.auction.count({ where: { id } })
      : type === 'PPA_CONTRACT'
        ? await prisma.pPAContract.count({ where: { id } })
        : type === 'ENERGY_PROJECT'
          ? await prisma.energyProject.count({ where: { id } })
          : 1;
  if (!exists) {
    throw new AppError(404, 'REGULATION_SCOPE_NOT_FOUND', 'La entidad relacionada no existe.');
  }
};

const assertScopes = async (
  scopes: Array<{ entityType: RegulationScopeType; entityId: string }>,
): Promise<void> => {
  await Promise.all(scopes.map((scope) => assertScopeExists(scope.entityType, scope.entityId)));
};

const findRegulation = async (id: string, canManage: boolean) => {
  const regulation = await prisma.regulation.findFirst({
    where: { id, ...(canManage ? {} : { status: 'VIGENTE' }) },
    select: regulationSelect,
  });
  if (!regulation) {
    throw new AppError(404, 'REGULATION_NOT_FOUND', 'La regulación no existe o no es visible.');
  }
  return regulation;
};

router.get(
  '/',
  authenticate,
  requirePermission(permissions.regulatoryRead),
  asyncHandler(async (request, response) => {
    const query = regulationQuerySchema.parse(request.query);
    const canManage = request.auth!.permissions.includes(permissions.regulatoryManage);
    const where: Prisma.RegulationWhereInput = {
      ...(!canManage ? { status: 'VIGENTE' } : query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.authorityId ? { issuingOrganizationId: query.authorityId } : {}),
      ...(query.q
        ? { OR: [{ code: { contains: query.q } }, { title: { contains: query.q } }] }
        : {}),
    };
    const [regulations, total] = await prisma.$transaction([
      prisma.regulation.findMany({
        where,
        select: regulationSelect,
        orderBy: [{ effectiveFrom: 'desc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.regulation.count({ where }),
    ]);
    response.json({
      data: regulations,
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
  requirePermission(permissions.regulatoryRead),
  asyncHandler(async (request, response) => {
    const canManage = request.auth!.permissions.includes(permissions.regulatoryManage);
    response.json({ data: await findRegulation(parseId(request.params.id), canManage) });
  }),
);

router.post(
  '/',
  authenticate,
  requirePermission(permissions.regulatoryManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const input = regulationCreateSchema.parse(request.body);
    await assertAuthority(input.issuingOrganizationId);
    await assertScopes(input.scopes);
    if (await prisma.regulation.findUnique({ where: { code: input.code }, select: { id: true } })) {
      throw new AppError(409, 'REGULATION_CODE_EXISTS', 'Ya existe una regulación con ese código.');
    }
    const regulation = await prisma.$transaction(async (transaction) => {
      const created = await transaction.regulation.create({
        data: {
          code: input.code,
          title: input.title,
          summary: input.summary,
          type: input.type,
          issuingOrganizationId: input.issuingOrganizationId,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          sourceUrl: input.sourceUrl,
          documentReference: input.documentReference,
          createdByUserId: request.auth!.id,
          scopes: { create: input.scopes },
        },
      });
      await transaction.regulationEvent.create({
        data: {
          regulationId: created.id,
          changedByUserId: request.auth!.id,
          action: 'CREATE',
          newStatus: 'BORRADOR',
          snapshotJson: JSON.stringify(created),
        },
      });
      return created;
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'CREATE',
      module: 'REGULATORY',
      entity: 'Regulation',
      entityId: regulation.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: input,
    });
    response.status(201).json({ data: await findRegulation(regulation.id, true) });
  }),
);

router.put(
  '/:id',
  authenticate,
  requirePermission(permissions.regulatoryManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = regulationUpdateSchema.parse(request.body);
    const current = await findRegulation(id, true);
    if (current.status !== 'BORRADOR') {
      throw new AppError(
        409,
        'PUBLISHED_REGULATION_IMMUTABLE',
        'Una regulación publicada solo puede cambiar mediante una transición de estado.',
      );
    }
    if (input.issuingOrganizationId) await assertAuthority(input.issuingOrganizationId);
    if (input.scopes) await assertScopes(input.scopes);
    const effectiveFrom = input.effectiveFrom ?? current.effectiveFrom;
    const effectiveTo = input.effectiveTo ?? current.effectiveTo;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new AppError(400, 'INVALID_EFFECTIVE_DATES', 'El rango de vigencia no es válido.');
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.regulation.update({
        where: { id },
        data: {
          code: input.code,
          title: input.title,
          summary: input.summary,
          type: input.type,
          issuingOrganizationId: input.issuingOrganizationId,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          sourceUrl: input.sourceUrl,
          documentReference: input.documentReference,
        },
      });
      if (input.scopes) {
        await transaction.regulationScope.deleteMany({ where: { regulationId: id } });
        if (input.scopes.length) {
          await transaction.regulationScope.createMany({
            data: input.scopes.map((scope) => ({ ...scope, regulationId: id })),
          });
        }
      }
      await transaction.regulationEvent.create({
        data: {
          regulationId: id,
          changedByUserId: request.auth!.id,
          action: 'UPDATE',
          previousStatus: 'BORRADOR',
          newStatus: 'BORRADOR',
          snapshotJson: JSON.stringify(input),
        },
      });
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'UPDATE',
      module: 'REGULATORY',
      entity: 'Regulation',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: current,
      newValues: input,
    });
    response.json({ data: await findRegulation(id, true) });
  }),
);

router.patch(
  '/:id/status',
  authenticate,
  requirePermission(permissions.regulatoryManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = regulationStatusSchema.parse(request.body);
    const current = await findRegulation(id, true);
    assertRegulationTransition(current.status as RegulationStatus, input.status);
    const now = new Date();
    const changed = await prisma.$transaction(async (transaction) => {
      const result = await transaction.regulation.updateMany({
        where: { id, status: current.status },
        data: {
          status: input.status,
          ...(input.status === 'VIGENTE'
            ? { approvedAt: now, approvedByUserId: request.auth!.id }
            : {}),
        },
      });
      if (result.count !== 1) {
        throw new AppError(
          409,
          'REGULATION_CONCURRENT_CHANGE',
          'La regulación cambió mientras se procesaba la solicitud.',
        );
      }
      return transaction.regulationEvent.create({
        data: {
          regulationId: id,
          changedByUserId: request.auth!.id,
          action: input.status === 'VIGENTE' ? 'PUBLISH' : 'STATUS_CHANGE',
          previousStatus: current.status,
          newStatus: input.status,
          reason: input.reason,
          snapshotJson: JSON.stringify({ status: input.status, reason: input.reason }),
        },
      });
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: input.status === 'VIGENTE' ? 'PUBLISH' : 'STATUS_CHANGE',
      module: 'REGULATORY',
      entity: 'Regulation',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: { status: current.status },
      newValues: input,
    });
    if (input.status === 'VIGENTE') {
      await notificationService.notifyRegulationPublished({
        id,
        code: current.code,
        title: current.title,
      });
    }
    response.json({ data: await findRegulation(changed.regulationId, true) });
  }),
);

export { router as regulatoryRouter };
