import type { Prisma } from '@prisma/client';
import type { EvaluationType } from '@ecosoft/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { hasInstitutionalAccess } from '../../common/domain-access';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission, requireTrustedWebRequest } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { auctionAccessWhere } from '../auctions/auction-access';
import { calculateEvaluationTotal } from './evaluation-score';
import {
  awardCreateSchema,
  awardDecisionSchema,
  evaluationQuerySchema,
  evaluationSubmitSchema,
  matrixCreateSchema,
} from './evaluations.schemas';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});
const matrixSelect = {
  id: true,
  auctionId: true,
  versionNumber: true,
  name: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  criteria: { orderBy: [{ type: 'asc' as const }, { sortOrder: 'asc' as const }] },
  auction: { select: { code: true, title: true, status: true } },
} satisfies Prisma.EvaluationMatrixSelect;
const evaluationSelect = {
  id: true,
  matrixId: true,
  bidId: true,
  type: true,
  status: true,
  totalScore: true,
  comments: true,
  submittedAt: true,
  evaluator: { select: { id: true, firstName: true, lastName: true, email: true } },
  scores: {
    include: {
      criterion: { select: { code: true, title: true, weight: true, maximumScore: true } },
    },
  },
  bid: {
    select: {
      projectName: true,
      organizationId: true,
      organization: { select: { legalName: true } },
      auction: { select: { id: true, code: true } },
    },
  },
} satisfies Prisma.EvaluationSelect;
const awardSelect = {
  id: true,
  auctionId: true,
  bidId: true,
  resolutionNumber: true,
  awardedPrice: true,
  awardedCapacityMw: true,
  justification: true,
  status: true,
  approvedAt: true,
  createdAt: true,
  bid: {
    select: {
      projectName: true,
      organizationId: true,
      organization: { select: { legalName: true } },
    },
  },
  auction: { select: { code: true, title: true, status: true } },
  approvedBy: { select: { firstName: true, lastName: true, email: true } },
} satisfies Prisma.AwardSelect;

const assertEvaluatorType = (request: Request, type: EvaluationType): void => {
  if (request.auth!.roles.some((role) => ['SUPER_ADMIN', 'CNE_ADMIN'].includes(role))) return;
  const required = type === 'TECNICA' ? 'TECHNICAL_EVALUATOR' : 'FINANCIAL_EVALUATOR';
  if (!request.auth!.roles.includes(required))
    throw new AppError(
      403,
      'EVALUATION_ROLE_MISMATCH',
      'El rol no puede completar este tipo de evaluación.',
    );
};

router.get(
  '/matrices',
  authenticate,
  requirePermission(permissions.evaluationsRead),
  asyncHandler(async (request, response) => {
    const auctionId = z.uuid().optional().parse(request.query.auctionId);
    response.json({
      data: await prisma.evaluationMatrix.findMany({
        where: {
          ...(auctionId ? { auctionId } : {}),
          auction: auctionAccessWhere(request.auth!),
        },
        select: matrixSelect,
        orderBy: [{ auctionId: 'asc' }, { versionNumber: 'desc' }],
      }),
    });
  }),
);

router.post(
  '/matrices',
  authenticate,
  requirePermission(permissions.evaluationsManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const input = matrixCreateSchema.parse(request.body);
    const auction = await prisma.auction.findUnique({
      where: { id: input.auctionId },
      select: { id: true, status: true },
    });
    if (!auction || !['CERRADA', 'EN_EVALUACION'].includes(auction.status))
      throw new AppError(
        409,
        'AUCTION_NOT_READY_FOR_EVALUATION',
        'La subasta debe estar cerrada para configurar la evaluación.',
      );
    const last = await prisma.evaluationMatrix.aggregate({
      where: { auctionId: input.auctionId },
      _max: { versionNumber: true },
    });
    const matrix = await prisma.evaluationMatrix.create({
      data: {
        auctionId: input.auctionId,
        versionNumber: (last._max.versionNumber ?? 0) + 1,
        name: input.name,
        createdByUserId: request.auth!.id,
        criteria: { create: input.criteria },
      },
      select: matrixSelect,
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'CREATE',
      module: 'EVALUATIONS',
      entity: 'EvaluationMatrix',
      entityId: matrix.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: input,
    });
    response.status(201).json({ data: matrix });
  }),
);

router.post(
  '/matrices/:id/publish',
  authenticate,
  requirePermission(permissions.evaluationsManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const matrix = await prisma.evaluationMatrix.findUnique({
      where: { id },
      select: matrixSelect,
    });
    if (!matrix) throw new AppError(404, 'MATRIX_NOT_FOUND', 'La matriz no existe.');
    if (matrix.status !== 'BORRADOR')
      throw new AppError(409, 'MATRIX_IMMUTABLE', 'La matriz ya fue publicada.');
    if (
      !matrix.criteria.some((item) => item.type === 'TECNICA') ||
      !matrix.criteria.some((item) => item.type === 'FINANCIERA')
    )
      throw new AppError(
        409,
        'INCOMPLETE_MATRIX',
        'La matriz debe contener criterios técnicos y financieros.',
      );
    await prisma.$transaction(async (transaction) => {
      await transaction.evaluationMatrix.updateMany({
        where: { auctionId: matrix.auctionId, status: 'PUBLICADA' },
        data: { status: 'ARCHIVADA' },
      });
      await transaction.evaluationMatrix.update({
        where: { id },
        data: { status: 'PUBLICADA', publishedAt: new Date() },
      });
      await transaction.auction.update({
        where: { id: matrix.auctionId },
        data: { status: 'EN_EVALUACION' },
      });
      await transaction.auctionEvent.create({
        data: {
          auctionId: matrix.auctionId,
          createdByUserId: request.auth!.id,
          type: 'MATRIX_PUBLISHED',
          previousStatus: matrix.auction.status,
          newStatus: 'EN_EVALUACION',
          message: `Matriz ${matrix.name} publicada.`,
        },
      });
      await transaction.bid.updateMany({
        where: { auctionId: matrix.auctionId, status: 'ENVIADA' },
        data: { status: 'EN_EVALUACION' },
      });
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'PUBLISH',
      module: 'EVALUATIONS',
      entity: 'EvaluationMatrix',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
    });
    response.json({
      data: await prisma.evaluationMatrix.findUnique({ where: { id }, select: matrixSelect }),
    });
  }),
);

router.get(
  '/',
  authenticate,
  requirePermission(permissions.evaluationsRead),
  asyncHandler(async (request, response) => {
    const query = evaluationQuerySchema.parse(request.query);
    const where: Prisma.EvaluationWhereInput = {
      ...(query.auctionId ? { bid: { auctionId: query.auctionId } } : {}),
      ...(query.bidId ? { bidId: query.bidId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(!hasInstitutionalAccess(request.auth!)
        ? {
            bid: {
              organizationId: request.auth!.organizationId ?? '__none__',
              ...(query.auctionId ? { auctionId: query.auctionId } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.evaluation.findMany({
        where,
        select: evaluationSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.evaluation.count({ where }),
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

router.post(
  '/',
  authenticate,
  requirePermission(permissions.evaluationsSubmit),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const input = evaluationSubmitSchema.parse(request.body);
    assertEvaluatorType(request, input.type);
    const matrix = await prisma.evaluationMatrix.findFirst({
      where: { id: input.matrixId, status: 'PUBLICADA' },
      include: { criteria: { where: { type: input.type } } },
    });
    if (!matrix) throw new AppError(404, 'MATRIX_NOT_FOUND', 'La matriz publicada no existe.');
    const bid = await prisma.bid.findFirst({
      where: { id: input.bidId, auctionId: matrix.auctionId, status: 'EN_EVALUACION' },
      select: { id: true, organizationId: true },
    });
    if (!bid)
      throw new AppError(409, 'BID_NOT_EVALUABLE', 'La oferta no está disponible para evaluación.');
    const total = calculateEvaluationTotal(
      matrix.criteria.map((criterion) => ({
        id: criterion.id,
        maximumScore: Number(criterion.maximumScore),
        weight: Number(criterion.weight),
      })),
      input.scores,
    );
    const evaluation = await prisma.$transaction(async (transaction) => {
      const created = await transaction.evaluation.create({
        data: {
          matrixId: matrix.id,
          bidId: bid.id,
          evaluatorUserId: request.auth!.id,
          type: input.type,
          status: 'ENVIADA',
          totalScore: total,
          comments: input.comments,
          submittedAt: new Date(),
        },
      });
      await transaction.evaluationScore.createMany({
        data: input.scores.map((item) => ({
          evaluationId: created.id,
          criterionId: item.criterionId,
          score: item.score,
          comments: item.comments,
        })),
      });
      return created;
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'SUBMIT',
      module: 'EVALUATIONS',
      entity: 'Evaluation',
      entityId: evaluation.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: { ...input, totalScore: total },
    });
    response.status(201).json({
      data: await prisma.evaluation.findUnique({
        where: { id: evaluation.id },
        select: evaluationSelect,
      }),
    });
  }),
);

router.get(
  '/awards/list',
  authenticate,
  requirePermission(permissions.awardsRead),
  asyncHandler(async (request, response) => {
    const where: Prisma.AwardWhereInput = hasInstitutionalAccess(request.auth!)
      ? {}
      : { bid: { organizationId: request.auth!.organizationId ?? '__none__' } };
    response.json({
      data: await prisma.award.findMany({
        where,
        select: awardSelect,
        orderBy: { createdAt: 'desc' },
      }),
    });
  }),
);

router.post(
  '/awards',
  authenticate,
  requirePermission(permissions.awardsManage),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const input = awardCreateSchema.parse(request.body);
    const bid = await prisma.bid.findFirst({
      where: { id: input.bidId, status: 'EN_EVALUACION' },
      include: { evaluations: { where: { status: 'ENVIADA' }, select: { type: true } } },
    });
    if (
      !bid ||
      !bid.evaluations.some((item) => item.type === 'TECNICA') ||
      !bid.evaluations.some((item) => item.type === 'FINANCIERA')
    )
      throw new AppError(
        409,
        'INCOMPLETE_BID_EVALUATION',
        'La oferta requiere evaluación técnica y financiera enviada.',
      );
    if (input.awardedCapacityMw > Number(bid.offeredPowerMw))
      throw new AppError(
        400,
        'AWARD_CAPACITY_EXCEEDED',
        'La capacidad adjudicada excede la ofertada.',
      );
    if (input.awardedPrice > Number(bid.offeredPrice))
      throw new AppError(
        400,
        'AWARD_PRICE_EXCEEDED',
        'El precio adjudicado excede el precio ofertado.',
      );
    const existingAward = await prisma.award.findUnique({
      where: { bidId: input.bidId },
      select: { id: true },
    });
    if (existingAward)
      throw new AppError(409, 'AWARD_ALREADY_EXISTS', 'La oferta ya tiene una adjudicación.');
    const award = await prisma.award.create({
      data: {
        auctionId: bid.auctionId,
        bidId: bid.id,
        resolutionNumber: input.resolutionNumber,
        awardedPrice: input.awardedPrice,
        awardedCapacityMw: input.awardedCapacityMw,
        justification: input.justification,
        createdByUserId: request.auth!.id,
      },
      select: awardSelect,
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'CREATE',
      module: 'AWARDS',
      entity: 'Award',
      entityId: award.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: input,
    });
    response.status(201).json({ data: award });
  }),
);

router.post(
  '/awards/:id/approve',
  authenticate,
  requirePermission(permissions.awardsApprove),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = awardDecisionSchema.parse(request.body);
    const award = await prisma.award.findUnique({ where: { id }, select: awardSelect });
    if (!award) throw new AppError(404, 'AWARD_NOT_FOUND', 'La adjudicación no existe.');
    if (award.status !== 'BORRADOR')
      throw new AppError(409, 'AWARD_ALREADY_DECIDED', 'La adjudicación ya fue decidida.');
    if (award.auction.status !== 'EN_EVALUACION')
      throw new AppError(409, 'AUCTION_ALREADY_AWARDED', 'La subasta ya no admite adjudicaciones.');
    await prisma.$transaction(async (transaction) => {
      await transaction.award.update({
        where: { id },
        data: { status: 'APROBADA', approvedAt: new Date(), approvedByUserId: request.auth!.id },
      });
      await transaction.bid.update({ where: { id: award.bidId }, data: { status: 'ADJUDICADA' } });
      await transaction.bid.updateMany({
        where: { auctionId: award.auctionId, id: { not: award.bidId }, status: 'EN_EVALUACION' },
        data: { status: 'NO_SELECCIONADA' },
      });
      await transaction.auction.update({
        where: { id: award.auctionId },
        data: { status: 'ADJUDICADA' },
      });
      await transaction.auctionEvent.create({
        data: {
          auctionId: award.auctionId,
          createdByUserId: request.auth!.id,
          type: 'AWARD_APPROVED',
          previousStatus: award.auction.status,
          newStatus: 'ADJUDICADA',
          message: input.reason,
        },
      });
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: request.auth!.organizationId ?? undefined,
      action: 'APPROVE',
      module: 'AWARDS',
      entity: 'Award',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: input,
    });
    response.json({ data: await prisma.award.findUnique({ where: { id }, select: awardSelect }) });
  }),
);

export { router as evaluationsRouter };
