import type { Prisma } from '@prisma/client';
import type { BidStatus, SessionUser } from '@ecosoft/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { hasInstitutionalAccess, requireOrganization } from '../../common/domain-access';
import { createSnapshot } from '../../common/snapshot';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission, requireTrustedWebRequest } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { assertBidTransition } from './bid-state';
import { bidActionSchema, bidCreateSchema, bidQuerySchema, bidUpdateSchema } from './bids.schemas';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});

const bidSelect = {
  id: true,
  auctionId: true,
  organizationId: true,
  projectName: true,
  renewableTechnologyCode: true,
  projectLocation: true,
  offeredPowerMw: true,
  estimatedEnergyMwh: true,
  offeredPrice: true,
  currencyCode: true,
  validUntil: true,
  status: true,
  submittedAt: true,
  withdrawnAt: true,
  submissionHash: true,
  createdAt: true,
  updatedAt: true,
  auction: { select: { id: true, code: true, title: true, status: true, closeAt: true } },
  organization: { select: { id: true, legalName: true, commercialName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  versions: {
    orderBy: { versionNumber: 'desc' as const },
    select: {
      id: true,
      versionNumber: true,
      snapshotHash: true,
      changeReason: true,
      createdAt: true,
    },
  },
  evaluations: {
    where: { status: 'ENVIADA' },
    select: { id: true, type: true, totalScore: true, submittedAt: true },
  },
  award: { select: { id: true, resolutionNumber: true, status: true } },
} satisfies Prisma.BidSelect;

const scopeWhere = (actor: SessionUser): Prisma.BidWhereInput =>
  hasInstitutionalAccess(actor) ? {} : { organizationId: actor.organizationId ?? '__none__' };

const hideFinancialData = (actor: SessionUser): boolean =>
  actor.roles.includes('TECHNICAL_EVALUATOR') &&
  !actor.roles.some((role) =>
    ['SUPER_ADMIN', 'CNE_ADMIN', 'FINANCIAL_EVALUATOR', 'AUCTION_MANAGER', 'AUDITOR'].includes(
      role,
    ),
  );

const presentBid = <T extends { offeredPrice: unknown; currencyCode: unknown }>(
  bid: T,
  actor: SessionUser,
) => (hideFinancialData(actor) ? { ...bid, offeredPrice: null, currencyCode: null } : bid);

const getBid = async (id: string, actor: SessionUser) => {
  const bid = await prisma.bid.findFirst({
    where: { id, ...scopeWhere(actor) },
    select: bidSelect,
  });
  if (!bid) throw new AppError(404, 'BID_NOT_FOUND', 'La oferta no existe o no está disponible.');
  return bid;
};

const assertOwner = (actor: SessionUser, organizationId: string): void => {
  if (actor.organizationId !== organizationId) {
    throw new AppError(404, 'BID_NOT_FOUND', 'La oferta no existe o no está disponible.');
  }
};

const nextVersion = async (bidId: string): Promise<number> => {
  const aggregate = await prisma.bidVersion.aggregate({
    where: { bidId },
    _max: { versionNumber: true },
  });
  return (aggregate._max.versionNumber ?? 0) + 1;
};

router.get(
  '/',
  authenticate,
  requirePermission(permissions.bidsRead),
  asyncHandler(async (request, response) => {
    const query = bidQuerySchema.parse(request.query);
    const actor = request.auth!;
    const where: Prisma.BidWhereInput = {
      ...scopeWhere(actor),
      ...(query.auctionId ? { auctionId: query.auctionId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(hasInstitutionalAccess(actor) && query.organizationId
        ? { organizationId: query.organizationId }
        : {}),
      ...(query.q
        ? {
            OR: [
              { projectName: { contains: query.q } },
              { organization: { legalName: { contains: query.q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.bid.findMany({
        where,
        select: bidSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.bid.count({ where }),
    ]);
    response.json({
      data: items.map((item) => presentBid(item, actor)),
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
  requirePermission(permissions.bidsRead),
  asyncHandler(async (request, response) => {
    response.json({
      data: presentBid(await getBid(parseId(request.params.id), request.auth!), request.auth!),
    });
  }),
);

router.post(
  '/',
  authenticate,
  requirePermission(permissions.bidsSubmit),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const input = bidCreateSchema.parse(request.body);
    const organizationId = requireOrganization(request.auth!);
    const auction = await prisma.auction.findFirst({
      where: {
        id: input.auctionId,
        status: 'ABIERTA',
        closeAt: { gt: new Date() },
        participants: { some: { organizationId, status: 'HABILITADO' } },
      },
      select: { id: true, renewableTechnologyCode: true, currencyCode: true, maximumPrice: true },
    });
    if (!auction)
      throw new AppError(
        409,
        'AUCTION_NOT_OPEN',
        'La organización no puede ofertar en esta subasta.',
      );
    if (
      input.renewableTechnologyCode !== auction.renewableTechnologyCode ||
      input.currencyCode !== auction.currencyCode
    ) {
      throw new AppError(
        400,
        'BID_CATALOG_MISMATCH',
        'La tecnología y moneda deben coincidir con la subasta.',
      );
    }
    if (auction.maximumPrice && input.offeredPrice > Number(auction.maximumPrice)) {
      throw new AppError(
        400,
        'BID_PRICE_EXCEEDS_MAXIMUM',
        'El precio excede el máximo configurado.',
      );
    }
    const created = await prisma.$transaction(async (transaction) => {
      const bid = await transaction.bid.create({
        data: { ...input, organizationId, createdByUserId: request.auth!.id },
      });
      const snapshot = createSnapshot(bid);
      await transaction.bidVersion.create({
        data: {
          bidId: bid.id,
          versionNumber: 1,
          snapshotJson: snapshot.json,
          snapshotHash: snapshot.hash,
          changeReason: 'Creación inicial de la oferta.',
          changedByUserId: request.auth!.id,
        },
      });
      return bid;
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId,
      action: 'CREATE',
      module: 'BIDS',
      entity: 'Bid',
      entityId: created.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: input,
    });
    response.status(201).json({ data: await getBid(created.id, request.auth!) });
  }),
);

router.put(
  '/:id',
  authenticate,
  requirePermission(permissions.bidsSubmit),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = bidUpdateSchema.parse(request.body);
    const current = await getBid(id, request.auth!);
    assertOwner(request.auth!, current.organizationId);
    if (current.status !== 'BORRADOR')
      throw new AppError(409, 'BID_IMMUTABLE', 'Una oferta enviada no admite edición.');
    const { changeReason, ...data } = input;
    const versionNumber = await nextVersion(id);
    const updated = await prisma.$transaction(async (transaction) => {
      const bid = await transaction.bid.update({ where: { id }, data });
      const snapshot = createSnapshot(bid);
      await transaction.bidVersion.create({
        data: {
          bidId: id,
          versionNumber,
          snapshotJson: snapshot.json,
          snapshotHash: snapshot.hash,
          changeReason,
          changedByUserId: request.auth!.id,
        },
      });
      return bid;
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: current.organizationId,
      action: 'UPDATE',
      module: 'BIDS',
      entity: 'Bid',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: current,
      newValues: input,
    });
    response.json({ data: presentBid(await getBid(updated.id, request.auth!), request.auth!) });
  }),
);

router.post(
  '/:id/submit',
  authenticate,
  requirePermission(permissions.bidsSubmit),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = bidActionSchema.parse(request.body);
    const current = await getBid(id, request.auth!);
    assertOwner(request.auth!, current.organizationId);
    assertBidTransition(current.status as BidStatus, 'ENVIADA');
    if (current.auction.status !== 'ABIERTA' || current.auction.closeAt <= new Date())
      throw new AppError(409, 'AUCTION_CLOSED', 'La subasta ya no recibe ofertas.');
    const requirements = await prisma.auctionRequirement.findMany({
      where: { auctionId: current.auctionId, isMandatory: true },
      select: { code: true },
    });
    const documents = await prisma.document.findMany({
      where: { entityType: 'BID', entityId: id, status: 'ACTIVE' },
      select: {
        documentType: true,
        currentVersionNumber: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { sha256: true } },
      },
    });
    const uploadedTypes = new Set(documents.map((item) => item.documentType));
    const missing = requirements.filter((requirement) => !uploadedTypes.has(requirement.code));
    if (missing.length)
      throw new AppError(
        409,
        'MISSING_BID_DOCUMENTS',
        'Faltan documentos obligatorios.',
        missing.map((item) => item.code),
      );
    const snapshot = createSnapshot({ bid: current, documents });
    const versionNumber = await nextVersion(id);
    await prisma.$transaction(async (transaction) => {
      const result = await transaction.bid.updateMany({
        where: { id, status: 'BORRADOR' },
        data: { status: 'ENVIADA', submittedAt: new Date(), submissionHash: snapshot.hash },
      });
      if (result.count !== 1)
        throw new AppError(409, 'BID_CONCURRENT_CHANGE', 'La oferta cambió durante el envío.');
      await transaction.bidVersion.create({
        data: {
          bidId: id,
          versionNumber,
          snapshotJson: snapshot.json,
          snapshotHash: snapshot.hash,
          changeReason: input.reason,
          changedByUserId: request.auth!.id,
        },
      });
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: current.organizationId,
      action: 'SUBMIT',
      module: 'BIDS',
      entity: 'Bid',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: { submissionHash: snapshot.hash },
    });
    response.json({ data: await getBid(id, request.auth!) });
  }),
);

router.post(
  '/:id/withdraw',
  authenticate,
  requirePermission(permissions.bidsSubmit),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = bidActionSchema.parse(request.body);
    const current = await getBid(id, request.auth!);
    assertOwner(request.auth!, current.organizationId);
    assertBidTransition(current.status as BidStatus, 'RETIRADA');
    if (current.auction.closeAt <= new Date())
      throw new AppError(
        409,
        'WITHDRAWAL_DEADLINE_PASSED',
        'La oferta no puede retirarse después del cierre.',
      );
    await prisma.bid.update({
      where: { id },
      data: { status: 'RETIRADA', withdrawnAt: new Date() },
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: current.organizationId,
      action: 'WITHDRAW',
      module: 'BIDS',
      entity: 'Bid',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: input,
    });
    response.json({ data: await getBid(id, request.auth!) });
  }),
);

export { router as bidsRouter };
