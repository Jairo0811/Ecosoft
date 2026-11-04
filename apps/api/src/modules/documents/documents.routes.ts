import type { Prisma } from '@prisma/client';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { hasInstitutionalAccess, organizationScopeId } from '../../common/domain-access';
import { isUniqueConstraintViolation } from '../../common/prisma-errors';
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

/** ASCII fallback plus RFC 5987 UTF-8 name so accented Spanish file names survive downloads. */
export const contentDisposition = (fileName: string): string => {
  const fallback = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]|["\\/;]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

const scope = (request: Request): Prisma.DocumentWhereInput =>
  hasInstitutionalAccess(request.auth!)
    ? {}
    : { organizationId: organizationScopeId(request.auth!) };

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
    const content = await documentStorage.readVerified(version.storageKey, version.sha256);
    response.setHeader('Content-Type', version.mimeType);
    response.setHeader('Content-Disposition', contentDisposition(version.originalFileName));
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
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
    // Validate name, declared type and real content before anything touches the disk.
    const prepared = documentStorage.prepare(input.contentBase64, input.fileName, input.mimeType);
    const organizationId = await resolveOrganization(input.entityType, input.entityId);
    if (!organizationId)
      throw new AppError(404, 'DOCUMENT_ENTITY_NOT_FOUND', 'La entidad asociada no existe.');
    if (!hasInstitutionalAccess(request.auth!) && request.auth!.organizationId !== organizationId)
      throw new AppError(404, 'DOCUMENT_ENTITY_NOT_FOUND', 'La entidad asociada no existe.');

    const stored = await documentStorage.write(prepared);
    let committed = false;
    let documentId: string;
    try {
      // Document, first version and audit evidence commit atomically: either all exist or none.
      documentId = await prisma.$transaction(async (transaction) => {
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
        await auditService.record(
          {
            userId: request.auth!.id,
            organizationId,
            action: 'UPLOAD',
            module: 'DOCUMENTS',
            entity: 'Document',
            entityId: created.id,
            result: 'SUCCESS',
            ...metadata(request),
            newValues: {
              ...input,
              contentBase64: '[REDACTED]',
              sha256: stored.sha256,
              sizeBytes: stored.sizeBytes,
            },
          },
          transaction,
        );
        return created.id;
      });
      committed = true;
    } finally {
      // Only an uncommitted write is compensated. Once committed, the record owns the file and
      // a later failure (e.g. building the response) must never delete it.
      if (!committed)
        await documentStorage.discardUncommitted(stored.storageKey, request.correlationId);
    }
    response.status(201).json({ data: await getDocument(documentId, request) });
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
    const prepared = documentStorage.prepare(input.contentBase64, input.fileName, input.mimeType);
    const expectedVersion = document.currentVersionNumber;
    const versionNumber = expectedVersion + 1;
    const conflict = () =>
      new AppError(
        409,
        'DOCUMENT_VERSION_CONFLICT',
        'El documento fue modificado por otra operación. Actualice la vista e intente nuevamente.',
      );

    const stored = await documentStorage.write(prepared);
    let committed = false;
    try {
      await prisma.$transaction(async (transaction) => {
        // Optimistic concurrency: only the request that observed the current version advances it.
        const advanced = await transaction.document.updateMany({
          where: { id, status: 'ACTIVE', currentVersionNumber: expectedVersion },
          data: { currentVersionNumber: versionNumber, extractedText: null },
        });
        if (advanced.count !== 1) throw conflict();
        await transaction.documentVersion.create({
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
        });
        await auditService.record(
          {
            userId: request.auth!.id,
            organizationId: document.organizationId ?? undefined,
            action: 'VERSION',
            module: 'DOCUMENTS',
            entity: 'Document',
            entityId: id,
            result: 'SUCCESS',
            ...metadata(request),
            newValues: { versionNumber, sha256: stored.sha256, sizeBytes: stored.sizeBytes },
          },
          transaction,
        );
      });
      committed = true;
    } catch (error) {
      // The (documentId, versionNumber) unique index is the last line of defence.
      if (isUniqueConstraintViolation(error)) throw conflict();
      throw error;
    } finally {
      if (!committed)
        await documentStorage.discardUncommitted(stored.storageKey, request.correlationId);
    }
    response.status(201).json({ data: await getDocument(id, request) });
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
