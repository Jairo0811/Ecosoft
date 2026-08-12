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
  catalogCreateSchema,
  catalogQuerySchema,
  catalogUpdateSchema,
  parseMetadata,
  serializeMetadata,
} from './catalogs.schemas';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);

const presentCatalogItem = (item: { metadataJson: string | null; [key: string]: unknown }) => {
  const { metadataJson, ...rest } = item;
  return { ...rest, metadata: parseMetadata(metadataJson) };
};

const getCatalogItem = async (id: string) => {
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item)
    throw new AppError(404, 'CATALOG_ITEM_NOT_FOUND', 'El elemento de catálogo no existe.');
  return item;
};

const ensureCodeAvailable = async (type: string, code: string, excludedId?: string) => {
  const item = await prisma.catalogItem.findFirst({
    where: { type, code, ...(excludedId ? { id: { not: excludedId } } : {}) },
    select: { id: true },
  });
  if (item) {
    throw new AppError(
      409,
      'CATALOG_CODE_ALREADY_EXISTS',
      'El código ya existe dentro de este catálogo.',
    );
  }
};

router.get(
  '/',
  authenticate,
  requirePermission(permissions.catalogsRead),
  asyncHandler(async (request, response) => {
    const query = catalogQuerySchema.parse(request.query);
    const where: Prisma.CatalogItemWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.active === undefined ? {} : { isActive: query.active }),
      ...(query.q
        ? { OR: [{ code: { contains: query.q } }, { name: { contains: query.q } }] }
        : {}),
    };
    const items = await prisma.catalogItem.findMany({
      where,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    response.json({ data: items.map(presentCatalogItem) });
  }),
);

router.post(
  '/',
  authenticate,
  requirePermission(permissions.catalogsManage),
  asyncHandler(async (request, response) => {
    const input = catalogCreateSchema.parse(request.body);
    await ensureCodeAvailable(input.type, input.code);
    const item = await prisma.catalogItem.create({
      data: {
        type: input.type,
        code: input.code,
        name: input.name,
        description: input.description,
        sortOrder: input.sortOrder,
        metadataJson: serializeMetadata(input.metadata),
      },
    });
    await auditService.record({
      userId: request.auth?.id,
      organizationId: request.auth?.organizationId ?? undefined,
      action: 'CREATE',
      module: 'CATALOGS',
      entity: 'CatalogItem',
      entityId: item.id,
      result: 'SUCCESS',
      correlationId: request.correlationId,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      newValues: presentCatalogItem(item),
    });
    response.status(201).json({ data: presentCatalogItem(item) });
  }),
);

router.patch(
  '/:id',
  authenticate,
  requirePermission(permissions.catalogsManage),
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = catalogUpdateSchema.parse(request.body);
    if (Object.keys(input).length === 0) {
      throw new AppError(400, 'EMPTY_UPDATE', 'Debe indicar al menos un campo para actualizar.');
    }
    const previous = await getCatalogItem(id);
    if (input.code) await ensureCodeAvailable(previous.type, input.code, previous.id);
    const item = await prisma.catalogItem.update({
      where: { id: previous.id },
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        sortOrder: input.sortOrder,
        metadataJson: serializeMetadata(input.metadata),
      },
    });
    await auditService.record({
      userId: request.auth?.id,
      organizationId: request.auth?.organizationId ?? undefined,
      action: 'UPDATE',
      module: 'CATALOGS',
      entity: 'CatalogItem',
      entityId: item.id,
      result: 'SUCCESS',
      correlationId: request.correlationId,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      previousValues: presentCatalogItem(previous),
      newValues: presentCatalogItem(item),
    });
    response.json({ data: presentCatalogItem(item) });
  }),
);

router.patch(
  '/:id/status',
  authenticate,
  requirePermission(permissions.catalogsManage),
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const { isActive } = request.body as { isActive?: unknown };
    if (typeof isActive !== 'boolean') {
      throw new AppError(400, 'VALIDATION_ERROR', 'isActive debe ser booleano.');
    }
    const previous = await getCatalogItem(id);
    const item = await prisma.catalogItem.update({
      where: { id: previous.id },
      data: { isActive },
    });
    await auditService.record({
      userId: request.auth?.id,
      organizationId: request.auth?.organizationId ?? undefined,
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
      module: 'CATALOGS',
      entity: 'CatalogItem',
      entityId: item.id,
      result: 'SUCCESS',
      correlationId: request.correlationId,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      previousValues: { isActive: previous.isActive },
      newValues: { isActive: item.isActive },
    });
    response.json({ data: presentCatalogItem(item) });
  }),
);

export { router as catalogsRouter };
