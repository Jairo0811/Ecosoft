import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import {
  organizationCreateSchema,
  organizationQuerySchema,
  organizationStatusSchema,
  organizationUpdateSchema,
} from './organizations.schemas';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);

const organizationSelect = {
  id: true,
  rnc: true,
  legalName: true,
  commercialName: true,
  type: true,
  status: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  website: true,
  rejectionReason: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  _count: { select: { users: true } },
} satisfies Prisma.OrganizationSelect;

const getOrganization = async (id: string) => {
  const organization = await prisma.organization.findUnique({
    where: { id },
    select: organizationSelect,
  });
  if (!organization) {
    throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'La organización no existe.');
  }
  return organization;
};

const ensureRncAvailable = async (rnc: string | undefined, excludedId?: string) => {
  if (!rnc) return;
  const existing = await prisma.organization.findFirst({
    where: { rnc, ...(excludedId ? { id: { not: excludedId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(409, 'RNC_ALREADY_REGISTERED', 'Ya existe una organización con este RNC.');
  }
};

router.get(
  '/',
  authenticate,
  requirePermission(permissions.organizationsRead),
  asyncHandler(async (request, response) => {
    const query = organizationQuerySchema.parse(request.query);
    const where: Prisma.OrganizationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.q
        ? {
            OR: [
              { legalName: { contains: query.q } },
              { commercialName: { contains: query.q } },
              { rnc: { contains: query.q } },
            ],
          }
        : {}),
    };
    const [organizations, total] = await prisma.$transaction([
      prisma.organization.findMany({
        where,
        select: organizationSelect,
        orderBy: [{ status: 'asc' }, { legalName: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.organization.count({ where }),
    ]);
    response.json({
      data: organizations,
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
  requirePermission(permissions.organizationsRead),
  asyncHandler(async (request, response) => {
    response.json({ data: await getOrganization(parseId(request.params.id)) });
  }),
);

router.post(
  '/',
  authenticate,
  requirePermission(permissions.organizationsManage),
  asyncHandler(async (request, response) => {
    const input = organizationCreateSchema.parse(request.body);
    await ensureRncAvailable(input.rnc);
    const organization = await prisma.organization.create({
      data: input,
      select: organizationSelect,
    });
    await auditService.record({
      userId: request.auth?.id,
      organizationId: organization.id,
      action: 'CREATE',
      module: 'ORGANIZATIONS',
      entity: 'Organization',
      entityId: organization.id,
      result: 'SUCCESS',
      correlationId: request.correlationId,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      newValues: organization,
    });
    response.status(201).json({ data: organization });
  }),
);

router.patch(
  '/:id',
  authenticate,
  requirePermission(permissions.organizationsManage),
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = organizationUpdateSchema.parse(request.body);
    if (Object.keys(input).length === 0) {
      throw new AppError(400, 'EMPTY_UPDATE', 'Debe indicar al menos un campo para actualizar.');
    }
    const previous = await getOrganization(id);
    await ensureRncAvailable(input.rnc, id);
    const organization = await prisma.organization.update({
      where: { id },
      data: input,
      select: organizationSelect,
    });
    await auditService.record({
      userId: request.auth?.id,
      organizationId: organization.id,
      action: 'UPDATE',
      module: 'ORGANIZATIONS',
      entity: 'Organization',
      entityId: organization.id,
      result: 'SUCCESS',
      correlationId: request.correlationId,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      previousValues: previous,
      newValues: organization,
    });
    response.json({ data: organization });
  }),
);

router.patch(
  '/:id/status',
  authenticate,
  requirePermission(permissions.organizationsApprove),
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const decision = organizationStatusSchema.parse(request.body);
    const previous = await getOrganization(id);
    if (previous.type === 'REGULATORY_AUTHORITY' && decision.status !== 'APPROVED') {
      throw new AppError(
        409,
        'REGULATORY_AUTHORITY_PROTECTED',
        'La autoridad reguladora principal no puede ser rechazada ni suspendida.',
      );
    }
    const organization = await prisma.organization.update({
      where: { id },
      data: {
        status: decision.status,
        rejectionReason: ['REJECTED', 'SUSPENDED'].includes(decision.status)
          ? decision.reason
          : null,
        reviewedAt: new Date(),
        reviewedByUserId: request.auth?.id,
      },
      select: organizationSelect,
    });
    await auditService.record({
      userId: request.auth?.id,
      organizationId: organization.id,
      action: 'STATUS_CHANGE',
      module: 'ORGANIZATIONS',
      entity: 'Organization',
      entityId: organization.id,
      result: 'SUCCESS',
      correlationId: request.correlationId,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      previousValues: { status: previous.status, reason: previous.rejectionReason },
      newValues: { status: organization.status, reason: organization.rejectionReason },
    });
    response.json({ data: organization });
  }),
);

export { router as organizationsRouter };
