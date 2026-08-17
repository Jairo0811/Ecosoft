import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@ecosoft/shared';
import type { AnalyticsQuery } from './analytics.schemas';

const institutionalRoles = new Set([
  'SUPER_ADMIN',
  'CNE_ADMIN',
  'AUCTION_MANAGER',
  'TECHNICAL_EVALUATOR',
  'FINANCIAL_EVALUATOR',
  'REGULATORY_SUPERVISOR',
  'AUDITOR',
]);

export const hasInstitutionalAnalyticsAccess = (actor: SessionUser): boolean =>
  actor.roles.some((role) => institutionalRoles.has(role));

export const analyticsOrganizationId = (
  actor: SessionUser,
  query: AnalyticsQuery,
): string | undefined =>
  hasInstitutionalAnalyticsAccess(actor)
    ? query.organizationId
    : (actor.organizationId ?? undefined);

const dateFilter = (query: AnalyticsQuery): Prisma.DateTimeFilter | undefined =>
  query.from || query.to ? { gte: query.from, lte: query.to } : undefined;

export const analyticsScopes = (actor: SessionUser, query: AnalyticsQuery) => {
  const organizationId = analyticsOrganizationId(actor, query);
  const auctionDate = dateFilter(query);
  const auction: Prisma.AuctionWhereInput = {
    ...(auctionDate ? { openAt: auctionDate } : {}),
    ...(query.technology ? { renewableTechnologyCode: query.technology } : {}),
    ...(organizationId
      ? {
          OR: [
            { participants: { some: { organizationId, status: 'HABILITADO' } } },
            { bids: { some: { organizationId } } },
          ],
        }
      : {}),
  };
  const bid: Prisma.BidWhereInput = {
    ...(organizationId ? { organizationId } : {}),
    ...(query.technology ? { renewableTechnologyCode: query.technology } : {}),
    ...(auctionDate ? { submittedAt: auctionDate } : {}),
  };
  const project: Prisma.EnergyProjectWhereInput = {
    ...(organizationId ? { organizationId } : {}),
    ...(query.technology ? { renewableTechnologyCode: query.technology } : {}),
    ...(auctionDate ? { createdAt: auctionDate } : {}),
  };
  const contract: Prisma.PPAContractWhereInput = {
    ...(organizationId ? { organizationId } : {}),
    ...(query.technology ? { project: { renewableTechnologyCode: query.technology } } : {}),
    ...(auctionDate ? { createdAt: auctionDate } : {}),
  };
  return { organizationId, auction, bid, project, contract };
};
