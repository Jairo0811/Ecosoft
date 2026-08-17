import { createHash } from 'node:crypto';
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
import { documentStorage } from '../documents/document-storage';
import { aiClient } from './ai-client';
import {
  aiAnalysisCreateSchema,
  aiOcrCreateSchema,
  aiQuerySchema,
  aiReviewSchema,
} from './ai.schemas';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});
const scope = (request: Request): Prisma.AIAnalysisWhereInput =>
  hasInstitutionalAccess(request.auth!)
    ? {}
    : { organizationId: request.auth!.organizationId ?? '__none__' };
const analysisSelect = {
  id: true,
  documentId: true,
  organizationId: true,
  operation: true,
  status: true,
  provider: true,
  sourceReferencesJson: true,
  resultJson: true,
  confidence: true,
  reviewDecision: true,
  reviewNotes: true,
  reviewedAt: true,
  createdAt: true,
  requestedBy: { select: { firstName: true, lastName: true } },
  reviewedBy: { select: { firstName: true, lastName: true } },
  document: { select: { title: true, documentType: true } },
} satisfies Prisma.AIAnalysisSelect;

const getDocument = async (documentId: string, request: Request) => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      status: 'ACTIVE',
      ...(hasInstitutionalAccess(request.auth!)
        ? {}
        : { organizationId: request.auth!.organizationId ?? '__none__' }),
    },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  });
  if (!document)
    throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'El documento no existe o no está disponible.');
  const version = document.versions[0];
  if (!version)
    throw new AppError(404, 'DOCUMENT_VERSION_NOT_FOUND', 'La versión documental no existe.');
  return { document, version };
};

router.get(
  '/',
  authenticate,
  requirePermission(permissions.aiUse),
  asyncHandler(async (request, response) => {
    const query = aiQuerySchema.parse(request.query);
    const where: Prisma.AIAnalysisWhereInput = {
      ...scope(request),
      ...(query.documentId ? { documentId: query.documentId } : {}),
      ...(query.operation ? { operation: query.operation } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.aIAnalysis.findMany({
        where,
        select: analysisSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.aIAnalysis.count({ where }),
    ]);
    response.json({
      data: items.map((item) => ({
        ...item,
        sourceReferences: JSON.parse(item.sourceReferencesJson) as unknown,
        result: JSON.parse(item.resultJson) as unknown,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  }),
);

router.post(
  '/analyze',
  authenticate,
  requirePermission(permissions.aiUse),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const input = aiAnalysisCreateSchema.parse(request.body);
    const { document } = await getDocument(input.documentId, request);
    if (!document.extractedText?.trim())
      throw new AppError(409, 'OCR_REQUIRED', 'Primero debe extraer el texto del documento.');
    const result = await aiClient.analyze(document.extractedText, input.operation);
    const analysis = await prisma.aIAnalysis.create({
      data: {
        documentId: document.id,
        organizationId: document.organizationId,
        requestedByUserId: request.auth!.id,
        operation: input.operation,
        provider: result.provider,
        inputHash: createHash('sha256').update(document.extractedText).digest('hex'),
        sourceReferencesJson: JSON.stringify(result.source_references),
        resultJson: JSON.stringify(result.result),
        confidence: result.confidence,
      },
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: document.organizationId ?? undefined,
      action: 'CREATE',
      module: 'AI',
      entity: 'AIAnalysis',
      entityId: analysis.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: { documentId: document.id, operation: input.operation, provider: result.provider },
    });
    response.status(201).json({
      data: await prisma.aIAnalysis.findUnique({
        where: { id: analysis.id },
        select: analysisSelect,
      }),
    });
  }),
);

router.post(
  '/ocr',
  authenticate,
  requirePermission(permissions.aiUse),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const input = aiOcrCreateSchema.parse(request.body);
    const { document, version } = await getDocument(input.documentId, request);
    const content = await documentStorage.read(version.storageKey);
    const result = await aiClient.ocr(content.toString('base64'), version.mimeType);
    const extractedText = typeof result.result.text === 'string' ? result.result.text.trim() : '';
    if (!extractedText)
      throw new AppError(422, 'OCR_EMPTY', 'No se pudo extraer texto verificable del documento.');
    const analysis = await prisma.$transaction(async (transaction) => {
      await transaction.document.update({ where: { id: document.id }, data: { extractedText } });
      return transaction.aIAnalysis.create({
        data: {
          documentId: document.id,
          organizationId: document.organizationId,
          requestedByUserId: request.auth!.id,
          operation: 'OCR',
          provider: result.provider,
          inputHash: version.sha256,
          sourceReferencesJson: JSON.stringify(result.source_references),
          resultJson: JSON.stringify(result.result),
          confidence: result.confidence,
        },
      });
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: document.organizationId ?? undefined,
      action: 'OCR',
      module: 'AI',
      entity: 'Document',
      entityId: document.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: { analysisId: analysis.id, provider: result.provider },
    });
    response.status(201).json({
      data: await prisma.aIAnalysis.findUnique({
        where: { id: analysis.id },
        select: analysisSelect,
      }),
    });
  }),
);

router.patch(
  '/:id/review',
  authenticate,
  requirePermission(permissions.aiReview),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = aiReviewSchema.parse(request.body);
    const current = await prisma.aIAnalysis.findFirst({ where: { id, ...scope(request) } });
    if (!current)
      throw new AppError(
        404,
        'AI_ANALYSIS_NOT_FOUND',
        'El análisis no existe o no está disponible.',
      );
    if (current.reviewDecision)
      throw new AppError(409, 'AI_ANALYSIS_REVIEWED', 'El análisis ya fue revisado.');
    const analysis = await prisma.aIAnalysis.update({
      where: { id },
      data: {
        reviewDecision: input.decision,
        reviewNotes: input.notes,
        reviewedAt: new Date(),
        reviewedByUserId: request.auth!.id,
      },
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: current.organizationId ?? undefined,
      action: 'REVIEW',
      module: 'AI',
      entity: 'AIAnalysis',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: { reviewDecision: null },
      newValues: input,
    });
    response.json({ data: analysis });
  }),
);

export { router as aiRouter };
