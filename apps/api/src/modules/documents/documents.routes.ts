import type { Prisma } from '@prisma/client';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { hasInstitutionalAccess } from '../../common/domain-access';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission, requireTrustedWebRequest } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { documentStorage } from './document-storage';
import {
  documentCreateSchema,
  documentQuerySchema,
  documentVersionSchema,
} from './documents.schemas';

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
  entityType: true,
  entityId: true,
  documentType: true,
  title: true,
  confidentiality: true,
  status: true,
  currentVersionNumber: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { firstName: true, lastName: true, email: true } },
  versions: {
    orderBy: { versionNumber: 'desc' as const },
    select: {
      id: true,
      versionNumber: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      sha256: true,
      createdAt: true,
    },
  },
} satisfies Prisma.DocumentSelect;

const scope = (request: Request): Prisma.DocumentWhereInput =>
  hasInstitutionalAccess(request.auth!)
    ? {}
    : { organizationId: request.auth!.organizationId ?? '__none__' };

const getDocument = async (id: string, request: Request) => {
  const document = await prisma.document.findFirst({ where: { id, ...scope(request) }, select });
  if (!document)
    throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'El documento no existe o no está disponible.');
  return document;
};

const resolveOrganization = async (
  entityType: string,
  entityId: string,
): Promise<string | undefined> => {
  if (entityType === 'BID')
    return (
      await prisma.bid.findUnique({ where: { id: entityId }, select: { organizationId: true } })
    )?.organizationId;
  if (entityType === 'PPA_CONTRACT')
    return (
      await prisma.pPAContract.findUnique({
        where: { id: entityId },
        select: { organizationId: true },
      })
    )?.organizationId;
  if (entityType === 'ENERGY_PROJECT')
    return (
      await prisma.energyProject.findUnique({
        where: { id: entityId },
        select: { organizationId: true },
      })
    )?.organizationId;
  if (entityType === 'EVALUATION')
    return (
      await prisma.evaluation.findUnique({
        where: { id: entityId },
        select: { bid: { select: { organizationId: true } } },
      })
    )?.bid.organizationId;
  if (entityType === 'AWARD')
    return (
      await prisma.award.findUnique({
        where: { id: entityId },
        select: { bid: { select: { organizationId: true } } },
      })
    )?.bid.organizationId;
  if (entityType === 'AUCTION')
    return (
      await prisma.auction.findUnique({
        where: { id: entityId },
        select: { managingOrganizationId: true },
      })
    )?.managingOrganizationId;
  if (entityType === 'REGULATION')
    return (
      await prisma.regulation.findUnique({
        where: { id: entityId },
        select: { issuingOrganizationId: true },
      })
    )?.issuingOrganizationId;
  return undefined;
};

router.get(
  '/',
  authenticate,
  requirePermission(permissions.documentsRead),
  asyncHandler(async (request, response) => {
    const query = documentQuerySchema.parse(request.query);
    const where: Prisma.DocumentWhereInput = {
      ...scope(request),
      status: query.status,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.document.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.document.count({ where }),
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
  requirePermission(permissions.documentsRead),
  asyncHandler(async (request, response) => {
    response.json({ data: await getDocument(parseId(request.params.id), request) });
  }),
);

router.get(
  '/:id/download',
  authenticate,
  requirePermission(permissions.documentsRead),
  asyncHandler(async (request, response) => {
    const document = await getDocument(parseId(request.params.id), request);
    const version = await prisma.documentVersion.findUnique({
      where: {
        documentId_versionNumber: {
          documentId: document.id,
          versionNumber: document.currentVersionNumber,
        },
      },
    });
    if (!version)
      throw new AppError(404, 'DOCUMENT_VERSION_NOT_FOUND', 'La versión documental no existe.');
    const content = await documentStorage.read(version.storageKey);
    const safeName = version.originalFileName.replace(/[\r\n"\\/]/g, '_');
    response.setHeader('Content-Type', version.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    response.setHeader('X-Content-SHA256', version.sha256);
    response.send(content);
  }),
);

router.post(
  '/',
  authenticate,
  requirePermission(permissions.documentsManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const input = documentCreateSchema.parse(request.body);
    const organizationId = await resolveOrganization(input.entityType, input.entityId);
    if (!organizationId)
      throw new AppError(404, 'DOCUMENT_ENTITY_NOT_FOUND', 'La entidad asociada no existe.');
    if (!hasInstitutionalAccess(request.auth!) && request.auth!.organizationId !== organizationId)
      throw new AppError(404, 'DOCUMENT_ENTITY_NOT_FOUND', 'La entidad asociada no existe.');
    const stored = await documentStorage.save(input.contentBase64);
    try {
      const document = await prisma.$transaction(async (transaction) => {
        const created = await transaction.document.create({
          data: {
            organizationId,
            createdByUserId: request.auth!.id,
            entityType: input.entityType,
            entityId: input.entityId,
            documentType: input.documentType,
            title: input.title,
            confidentiality: input.confidentiality,
          },
        });
        await transaction.documentVersion.create({
          data: {
            documentId: created.id,
            versionNumber: 1,
            storageKey: stored.storageKey,
            originalFileName: input.fileName,
            mimeType: input.mimeType,
            sizeBytes: stored.sizeBytes,
            sha256: stored.sha256,
            uploadedByUserId: request.auth!.id,
          },
        });
        return created;
      });
      await auditService.record({
        userId: request.auth!.id,
        organizationId,
        action: 'UPLOAD',
        module: 'DOCUMENTS',
        entity: 'Document',
        entityId: document.id,
        result: 'SUCCESS',
        ...metadata(request),
        newValues: {
          ...input,
          contentBase64: '[REDACTED]',
          sha256: stored.sha256,
          sizeBytes: stored.sizeBytes,
        },
      });
      response.status(201).json({ data: await getDocument(document.id, request) });
    } catch (error) {
      await documentStorage.remove(stored.storageKey);
      throw error;
    }
  }),
);

router.post(
  '/:id/versions',
  authenticate,
  requirePermission(permissions.documentsManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = documentVersionSchema.parse(request.body);
    const document = await getDocument(id, request);
    if (document.status !== 'ACTIVE')
      throw new AppError(409, 'DOCUMENT_ARCHIVED', 'El documento está archivado.');
    const stored = await documentStorage.save(input.contentBase64);
    const versionNumber = document.currentVersionNumber + 1;
    try {
      await prisma.$transaction([
        prisma.documentVersion.create({
          data: {
            documentId: id,
            versionNumber,
            storageKey: stored.storageKey,
            originalFileName: input.fileName,
            mimeType: input.mimeType,
            sizeBytes: stored.sizeBytes,
            sha256: stored.sha256,
            uploadedByUserId: request.auth!.id,
          },
        }),
        prisma.document.update({
          where: { id },
          data: { currentVersionNumber: versionNumber, extractedText: null },
        }),
      ]);
      await auditService.record({
        userId: request.auth!.id,
        organizationId: document.organizationId ?? undefined,
        action: 'VERSION',
        module: 'DOCUMENTS',
        entity: 'Document',
        entityId: id,
        result: 'SUCCESS',
        ...metadata(request),
        newValues: { versionNumber, sha256: stored.sha256, sizeBytes: stored.sizeBytes },
      });
      response.status(201).json({ data: await getDocument(id, request) });
    } catch (error) {
      await documentStorage.remove(stored.storageKey);
      throw error;
    }
  }),
);

router.patch(
  '/:id/archive',
  authenticate,
  requirePermission(permissions.documentsManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const document = await getDocument(parseId(request.params.id), request);
    await prisma.document.update({ where: { id: document.id }, data: { status: 'ARCHIVED' } });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: document.organizationId ?? undefined,
      action: 'ARCHIVE',
      module: 'DOCUMENTS',
      entity: 'Document',
      entityId: document.id,
      result: 'SUCCESS',
      ...metadata(request),
    });
    response.json({ data: await getDocument(document.id, request) });
  }),
);

export { router as documentsRouter };
