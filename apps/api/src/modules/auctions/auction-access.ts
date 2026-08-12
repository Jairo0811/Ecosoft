import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@ecosoft/shared';
import { AppError } from '../../common/app-error';

const institutionalRoles = new Set([
  'SUPER_ADMIN',
  'CNE_ADMIN',
  'AUCTION_MANAGER',
  'TECHNICAL_EVALUATOR',
  'FINANCIAL_EVALUATOR',
  'REGULATORY_SUPERVISOR',
  'AUDITOR',
]);

export const hasInstitutionalAuctionAccess = (actor: SessionUser): boolean =>
  actor.roles.some((role) => institutionalRoles.has(role));

export const auctionAccessWhere = (actor: SessionUser): Prisma.AuctionWhereInput => {
  if (hasInstitutionalAuctionAccess(actor)) return {};
  if (!actor.organizationId) return { id: { equals: '00000000-0000-0000-0000-000000000000' } };
  return {
    status: { notIn: ['BORRADOR', 'PROGRAMADA'] },
    participants: { some: { organizationId: actor.organizationId, status: 'HABILITADO' } },
  };
};

export const assertInstitutionalAuctionAccess = (actor: SessionUser): void => {
  if (!hasInstitutionalAuctionAccess(actor)) {
    throw new AppError(
      403,
      'INSTITUTIONAL_AUCTION_ACCESS_REQUIRED',
      'Esta operación está reservada al equipo institucional de subastas.',
    );
  }
};
