import type { Prisma } from '@prisma/client';
import type { ContractStatus } from '@ecosoft/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { hasInstitutionalAccess } from '../../common/domain-access';
import { createSnapshot } from '../../common/snapshot';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission, requireTrustedWebRequest } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { assertContractTransition } from './contract-state';
import {
  contractCreateSchema,
  contractQuerySchema,
  contractStatusSchema,
  contractUpdateSchema,
} from './contracts.schemas';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});
const select = {
  id: true,
  contractNumber: true,
  awardId: true,
  projectId: true,
  organizationId: true,
  status: true,
  signatureDate: true,
  startDate: true,
  endDate: true,
  price: true,
  currencyCode: true,
  capacityMw: true,
  committedEnergyMwh: true,
  conditions: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { legalName: true, commercialName: true } },
  project: { select: { name: true, renewableTechnologyCode: true, status: true } },
  award: {
    select: { resolutionNumber: true, status: true, bid: { select: { projectName: true } } },
  },
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
} satisfies Prisma.PPAContractSelect;
const scope = (request: Request): Prisma.PPAContractWhereInput =>
  hasInstitutionalAccess(request.auth!)
    ? {}
    : { organizationId: request.auth!.organizationId ?? '__none__' };
const getContract = async (id: string, request: Request) => {
  const contract = await prisma.pPAContract.findFirst({ where: { id, ...scope(request) }, select });
  if (!contract)
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'El contrato no existe o no está disponible.');
  return contract;
};
const nextVersion = async (contractId: string): Promise<number> =>
  (
    await prisma.pPAContractVersion.aggregate({
      where: { contractId },
      _max: { versionNumber: true },
    })
  )._max.versionNumber ?? 0;

router.get(
  '/',
  authenticate,
  requirePermission(permissions.contractsRead),
  asyncHandler(async (request, response) => {
    const query = contractQuerySchema.parse(request.query);
    const where: Prisma.PPAContractWhereInput = {
      ...scope(request),
      ...(hasInstitutionalAccess(request.auth!) && query.organizationId
        ? { organizationId: query.organizationId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.expiringBefore ? { endDate: { lte: query.expiringBefore } } : {}),
      ...(query.q
        ? {
            OR: [
              { contractNumber: { contains: query.q } },
              { project: { name: { contains: query.q } } },
              { organization: { legalName: { contains: query.q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.pPAContract.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.pPAContract.count({ where }),
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
  requirePermission(permissions.contractsRead),
  asyncHandler(async (request, response) => {
    response.json({ data: await getContract(parseId(request.params.id), request) });
  }),
);

router.post(
  '/',
  authenticate,
  requirePermission(permissions.contractsCreate),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const input = contractCreateSchema.parse(request.body);
    const award = await prisma.award.findFirst({
      where: { id: input.awardId, status: 'APROBADA', contract: null },
      select: {
        id: true,
        awardedPrice: true,
        awardedCapacityMw: true,
        bid: { select: { organizationId: true, currencyCode: true } },
      },
    });
    const project = await prisma.energyProject.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        organizationId: true,
        installedCapacityMw: true,
        contractedCapacityMw: true,
        status: true,
      },
    });
    if (!award || !project || project.organizationId !== award.bid.organizationId)
      throw new AppError(
        409,
        'INVALID_CONTRACT_ORIGIN',
        'La adjudicación y el proyecto no son compatibles.',
      );
    if (
      project.status === 'FINALIZADO' ||
      input.capacityMw > Number(award.awardedCapacityMw) ||
      input.capacityMw > Number(project.installedCapacityMw) - Number(project.contractedCapacityMw)
    )
      throw new AppError(
        400,
        'CONTRACT_CAPACITY_EXCEEDED',
        'La capacidad contractual excede la adjudicada o instalada.',
      );
    if (input.currencyCode !== award.bid.currencyCode || input.price > Number(award.awardedPrice))
      throw new AppError(
        400,
        'CONTRACT_PRICE_MISMATCH',
        'El precio o moneda no respeta la adjudicación.',
      );
    const contract = await prisma.$transaction(async (transaction) => {
      const created = await transaction.pPAContract.create({
        data: {
          ...input,
          organizationId: award.bid.organizationId,
          createdByUserId: request.auth!.id,
        },
      });
      const snapshot = createSnapshot(created);
      await transaction.pPAContractVersion.create({
        data: {
          contractId: created.id,
          versionNumber: 1,
          snapshotJson: snapshot.json,
          snapshotHash: snapshot.hash,
          changeReason: 'Creación inicial del contrato PPA.',
          changedByUserId: request.auth!.id,
        },
      });
      await transaction.pPAContractEvent.create({
        data: {
          contractId: created.id,
          changedByUserId: request.auth!.id,
          newStatus: 'BORRADOR',
          reason: 'Creación inicial del contrato PPA.',
        },
      });
      return created;
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: contract.organizationId,
      action: 'CREATE',
      module: 'CONTRACTS',
      entity: 'PPAContract',
      entityId: contract.id,
      result: 'SUCCESS',
      ...metadata(request),
      newValues: input,
    });
    response.status(201).json({ data: await getContract(contract.id, request) });
  }),
);

router.put(
  '/:id',
  authenticate,
  requirePermission(permissions.contractsCreate),
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = contractUpdateSchema.parse(request.body);
    const current = await getContract(id, request);
    if (current.status !== 'BORRADOR')
      throw new AppError(409, 'CONTRACT_IMMUTABLE', 'El contrato solo se edita en borrador.');
    const { changeReason, ...data } = input;
    const startDate = data.startDate ?? current.startDate;
    const endDate = data.endDate ?? current.endDate;
    if (endDate <= startDate)
      throw new AppError(
        400,
        'INVALID_CONTRACT_DATES',
        'La fecha final debe ser posterior al inicio.',
      );
    const versionNumber = (await nextVersion(id)) + 1;
    const updated = await prisma.$transaction(async (transaction) => {
      const contract = await transaction.pPAContract.update({ where: { id }, data });
      const snapshot = createSnapshot(contract);
      await transaction.pPAContractVersion.create({
        data: {
          contractId: id,
          versionNumber,
          snapshotJson: snapshot.json,
          snapshotHash: snapshot.hash,
          changeReason,
          changedByUserId: request.auth!.id,
        },
      });
      return contract;
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: current.organizationId,
      action: 'UPDATE',
      module: 'CONTRACTS',
      entity: 'PPAContract',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: current,
      newValues: input,
    });
    response.json({ data: await getContract(updated.id, request) });
  }),
);

router.patch(
  '/:id/status',
  authenticate,
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = contractStatusSchema.parse(request.body);
    const permission =
      input.status === 'VIGENTE' ? permissions.contractsApprove : permissions.contractsCreate;
    if (!request.auth!.permissions.includes(permission)) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'No tiene permisos para realizar esta transición contractual.',
      );
    }
    const current = await getContract(id, request);
    assertContractTransition(current.status as ContractStatus, input.status);
    if (input.status === 'VIGENTE' && !(input.signatureDate ?? current.signatureDate))
      throw new AppError(
        400,
        'SIGNATURE_REQUIRED',
        'La fecha de firma es obligatoria para activar el contrato.',
      );
    const versionNumber = (await nextVersion(id)) + 1;
    await prisma.$transaction(
      async (transaction) => {
        if (input.status === 'VIGENTE' && current.status !== 'SUSPENDIDO') {
          const project = await transaction.energyProject.findUnique({
            where: { id: current.projectId },
            select: { installedCapacityMw: true, contractedCapacityMw: true },
          });
          if (
            !project ||
            Number(project.contractedCapacityMw) + Number(current.capacityMw) >
              Number(project.installedCapacityMw)
          )
            throw new AppError(
              409,
              'PROJECT_CAPACITY_EXCEEDED',
              'El proyecto no dispone de capacidad para activar el contrato.',
            );
        }
        const updated = await transaction.pPAContract.update({
          where: { id },
          data: {
            status: input.status,
            ...(input.signatureDate ? { signatureDate: input.signatureDate } : {}),
            ...(input.status === 'VIGENTE'
              ? { approvedAt: new Date(), approvedByUserId: request.auth!.id }
              : {}),
          },
        });
        await transaction.pPAContractEvent.create({
          data: {
            contractId: id,
            changedByUserId: request.auth!.id,
            previousStatus: current.status,
            newStatus: input.status,
            reason: input.reason,
          },
        });
        if (input.status === 'VIGENTE' && current.status !== 'SUSPENDIDO')
          await transaction.energyProject.update({
            where: { id: current.projectId },
            data: { contractedCapacityMw: { increment: current.capacityMw } },
          });
        const snapshot = createSnapshot(updated);
        await transaction.pPAContractVersion.create({
          data: {
            contractId: id,
            versionNumber,
            snapshotJson: snapshot.json,
            snapshotHash: snapshot.hash,
            changeReason: input.reason,
            changedByUserId: request.auth!.id,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    await auditService.record({
      userId: request.auth!.id,
      organizationId: current.organizationId,
      action: 'STATUS_CHANGE',
      module: 'CONTRACTS',
      entity: 'PPAContract',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: { status: current.status },
      newValues: input,
    });
    response.json({ data: await getContract(id, request) });
  }),
);

export { router as contractsRouter };
