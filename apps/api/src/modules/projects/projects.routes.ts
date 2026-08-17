import type { Prisma } from '@prisma/client';
import type { ProjectStatus } from '@ecosoft/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { hasInstitutionalAccess, requireOrganization } from '../../common/domain-access';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission, requireTrustedWebRequest } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { assertProjectTransition } from './project-state';
import {
  projectCreateSchema,
  projectQuerySchema,
  projectStatusSchema,
  projectUpdateSchema,
} from './projects.schemas';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});
const select = {
  id: true,
  organizationId: true,
  name: true,
  renewableTechnologyCode: true,
  province: true,
  municipality: true,
  installedCapacityMw: true,
  contractedCapacityMw: true,
  estimatedOperationDate: true,
  actualOperationDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { legalName: true, commercialName: true } },
  contracts: { select: { id: true, contractNumber: true, status: true, capacityMw: true } },
  events: {
    orderBy: { createdAt: 'desc' as const },
    take: 25,
    select: {
      previousStatus: true,
      newStatus: true,
      reason: true,
      createdAt: true,
      changedBy: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.EnergyProjectSelect;
const scope = (request: Request): Prisma.EnergyProjectWhereInput =>
  hasInstitutionalAccess(request.auth!)
    ? {}
    : { organizationId: request.auth!.organizationId ?? '__none__' };
const getProject = async (id: string, request: Request) => {
  const project = await prisma.energyProject.findFirst({
    where: { id, ...scope(request) },
    select,
  });
  if (!project)
    throw new AppError(404, 'PROJECT_NOT_FOUND', 'El proyecto no existe o no está disponible.');
  return project;
};

router.get(
  '/',
  authenticate,
  requirePermission(permissions.projectsRead),
  asyncHandler(async (request, response) => {
    const query = projectQuerySchema.parse(request.query);
    const where: Prisma.EnergyProjectWhereInput = {
      ...scope(request),
      ...(hasInstitutionalAccess(request.auth!) && query.organizationId
        ? { organizationId: query.organizationId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.technology ? { renewableTechnologyCode: query.technology } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { province: { contains: query.q } },
              { municipality: { contains: query.q } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.energyProject.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.energyProject.count({ where }),
    ]);
    response.json({
      data: items,
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
  requirePermission(permissions.projectsRead),
  asyncHandler(async (request, response) => {
    response.json({ data: await getProject(parseId(request.params.id), request) });
  }),
);

router.post(
  '/',
  authenticate,
  requirePermission(permissions.projectsManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const input = projectCreateSchema.parse(request.body);
    const organizationId = hasInstitutionalAccess(request.auth!)
      ? (input.organizationId ?? requireOrganization(request.auth!))
      : requireOrganization(request.auth!);
    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, status: 'APPROVED' },
      select: { id: true },
    });
    const technology = await prisma.catalogItem.findFirst({
      where: { type: 'ENERGY_TECHNOLOGY', code: input.renewableTechnologyCode, isActive: true },
      select: { id: true },
    });
    if (!organization || !technology)
      throw new AppError(
        400,
        'INVALID_PROJECT_REFERENCE',
        'La organización o tecnología no es válida.',
      );
    const project = await prisma.$transaction(async (transaction) => {
      const created = await transaction.energyProject.create({
        data: {
          organizationId,
          createdByUserId: request.auth!.id,
          name: input.name,
          renewableTechnologyCode: input.renewableTechnologyCode,
          province: input.province,
          municipality: input.municipality,
          installedCapacityMw: input.installedCapacityMw,
          estimatedOperationDate: input.estimatedOperationDate,
        },
      });
      await transaction.energyProjectEvent.create({
        data: {
          projectId: created.id,
          changedByUserId: request.auth!.id,
          newStatus: 'PROPUESTO',
          reason: 'Creación inicial del proyecto.',
        },
      });
      return created;
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId,
      action: 'CREATE',
      module: 'PROJECTS',
      entity: 'EnergyProject',
      entityId: project.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: input,
    });
    response.status(201).json({ data: await getProject(project.id, request) });
  }),
);

router.put(
  '/:id',
  authenticate,
  requirePermission(permissions.projectsManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = projectUpdateSchema.parse(request.body);
    const current = await getProject(id, request);
    if (current.status === 'FINALIZADO')
      throw new AppError(409, 'PROJECT_FINAL', 'Un proyecto finalizado no admite edición.');
    const { organizationId: ignored, ...data } = input;
    void ignored;
    await prisma.energyProject.update({ where: { id }, data });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: current.organizationId,
      action: 'UPDATE',
      module: 'PROJECTS',
      entity: 'EnergyProject',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: current,
      newValues: input,
    });
    response.json({ data: await getProject(id, request) });
  }),
);

router.patch(
  '/:id/status',
  authenticate,
  requirePermission(permissions.projectsManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = projectStatusSchema.parse(request.body);
    const current = await getProject(id, request);
    assertProjectTransition(current.status as ProjectStatus, input.status);
    await prisma.$transaction([
      prisma.energyProject.update({
        where: { id },
        data: {
          status: input.status,
          ...(input.status === 'OPERATIVO'
            ? { actualOperationDate: input.actualOperationDate ?? new Date() }
            : {}),
        },
      }),
      prisma.energyProjectEvent.create({
        data: {
          projectId: id,
          changedByUserId: request.auth!.id,
          previousStatus: current.status,
          newStatus: input.status,
          reason: input.reason,
        },
      }),
    ]);
    await auditService.record({
      userId: request.auth!.id,
      organizationId: current.organizationId,
      action: 'STATUS_CHANGE',
      module: 'PROJECTS',
      entity: 'EnergyProject',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: { status: current.status },
      newValues: input,
    });
    response.json({ data: await getProject(id, request) });
  }),
);

export { router as projectsRouter };
