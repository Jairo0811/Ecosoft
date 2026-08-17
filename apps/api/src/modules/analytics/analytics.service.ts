import type { SessionUser } from '@ecosoft/shared';
import { prisma } from '../../config/prisma';
import { analyticsScopes } from './analytics-access';
import type { AnalyticsQuery } from './analytics.schemas';

const number = (value: unknown): number => (value == null ? 0 : Number(value));
const monthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export const getDashboardAnalytics = async (actor: SessionUser, query: AnalyticsQuery) => {
  const scopes = analyticsScopes(actor, query);
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 86_400_000);
  const inNinetyDays = new Date(now.getTime() + 90 * 86_400_000);
  const trendFrom =
    query.from ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const trendTo = query.to ?? now;

  const [
    activeAuctions,
    pendingAuctions,
    auctionCapacity,
    participantOrganizations,
    bidSummary,
    approvedAwardSummary,
    contracts,
    activeContracts,
    expiringContractCount,
    expiringContracts,
    operationalProjects,
    projectsByTechnology,
    projectsByProvince,
    auctionsByStatus,
    currencyContracts,
    currencyAwards,
    trendAuctions,
    trendAwards,
    upcomingEvents,
    recentActivity,
    closingAuctions,
  ] = await Promise.all([
    prisma.auction.count({
      where: { ...scopes.auction, status: { in: ['PUBLICADA', 'ABIERTA', 'EN_EVALUACION'] } },
    }),
    prisma.auction.count({
      where: { ...scopes.auction, status: { in: ['BORRADOR', 'PROGRAMADA'] } },
    }),
    prisma.auction.aggregate({ where: scopes.auction, _sum: { capacityMw: true } }),
    prisma.auctionParticipant.findMany({
      where: {
        auction: scopes.auction,
        status: 'HABILITADO',
        ...(scopes.organizationId ? { organizationId: scopes.organizationId } : {}),
      },
      distinct: ['organizationId'],
      select: { organizationId: true },
    }),
    prisma.bid.aggregate({
      where: scopes.bid,
      _count: { _all: true },
      _sum: { offeredPowerMw: true },
    }),
    prisma.award.aggregate({
      where: { status: 'APROBADA', bid: scopes.bid },
      _count: { _all: true },
      _sum: { awardedCapacityMw: true },
    }),
    prisma.pPAContract.count({ where: scopes.contract }),
    prisma.pPAContract.count({ where: { ...scopes.contract, status: 'VIGENTE' } }),
    prisma.pPAContract.count({
      where: {
        ...scopes.contract,
        status: 'VIGENTE',
        endDate: { gte: now, lte: inNinetyDays },
      },
    }),
    prisma.pPAContract.findMany({
      where: {
        ...scopes.contract,
        status: 'VIGENTE',
        endDate: { gte: now, lte: inNinetyDays },
      },
      orderBy: { endDate: 'asc' },
      take: 8,
      select: {
        id: true,
        contractNumber: true,
        endDate: true,
        organization: { select: { legalName: true, commercialName: true } },
      },
    }),
    prisma.energyProject.aggregate({
      where: { ...scopes.project, status: 'OPERATIVO' },
      _count: { _all: true },
      _sum: { installedCapacityMw: true, contractedCapacityMw: true },
    }),
    prisma.energyProject.groupBy({
      by: ['renewableTechnologyCode'],
      where: scopes.project,
      _sum: { installedCapacityMw: true, contractedCapacityMw: true },
      orderBy: { renewableTechnologyCode: 'asc' },
    }),
    prisma.energyProject.groupBy({
      by: ['province'],
      where: scopes.project,
      _count: { _all: true },
      _sum: { installedCapacityMw: true },
      orderBy: { _sum: { installedCapacityMw: 'desc' } },
      take: 10,
    }),
    prisma.auction.groupBy({
      by: ['status'],
      where: scopes.auction,
      _count: { _all: true },
      _sum: { capacityMw: true },
    }),
    prisma.pPAContract.groupBy({
      by: ['currencyCode'],
      where: scopes.contract,
      _count: { _all: true },
      _sum: { committedEnergyMwh: true },
    }),
    prisma.award.findMany({
      where: { status: 'APROBADA', bid: scopes.bid },
      select: {
        awardedPrice: true,
        awardedCapacityMw: true,
        auction: { select: { currencyCode: true } },
      },
    }),
    prisma.auction.findMany({
      where: { ...scopes.auction, openAt: { gte: trendFrom, lte: trendTo } },
      select: { openAt: true, capacityMw: true },
    }),
    prisma.award.findMany({
      where: {
        status: 'APROBADA',
        approvedAt: { gte: trendFrom, lte: trendTo },
        bid: scopes.bid,
      },
      select: { approvedAt: true, awardedCapacityMw: true },
    }),
    prisma.calendarEvent.findMany({
      where: { auction: scopes.auction, startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      take: 8,
      select: { id: true, title: true, type: true, startsAt: true, endsAt: true },
    }),
    prisma.auditLog.findMany({
      where: scopes.organizationId ? { organizationId: scopes.organizationId } : {},
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        action: true,
        module: true,
        entity: true,
        result: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.auction.findMany({
      where: {
        ...scopes.auction,
        status: 'ABIERTA',
        closeAt: { gte: now, lte: inSevenDays },
      },
      orderBy: { closeAt: 'asc' },
      take: 8,
      select: { id: true, code: true, title: true, closeAt: true },
    }),
  ]);

  const averagePrices = new Map<string, { weightedPrice: number; capacity: number }>();
  for (const award of currencyAwards) {
    const currency = award.auction.currencyCode;
    const capacity = number(award.awardedCapacityMw);
    const current = averagePrices.get(currency) ?? { weightedPrice: 0, capacity: 0 };
    current.weightedPrice += number(award.awardedPrice) * capacity;
    current.capacity += capacity;
    averagePrices.set(currency, current);
  }

  const contractedValueByCurrency = await prisma.pPAContract.findMany({
    where: scopes.contract,
    select: { currencyCode: true, price: true, committedEnergyMwh: true },
  });
  const values = new Map<string, number>();
  for (const contract of contractedValueByCurrency) {
    values.set(
      contract.currencyCode,
      (values.get(contract.currencyCode) ?? 0) +
        number(contract.price) * number(contract.committedEnergyMwh),
    );
  }

  const trend = new Map<string, { auctionedMw: number; awardedMw: number }>();
  const cursor = new Date(Date.UTC(trendFrom.getUTCFullYear(), trendFrom.getUTCMonth(), 1));
  const last = new Date(Date.UTC(trendTo.getUTCFullYear(), trendTo.getUTCMonth(), 1));
  while (cursor <= last) {
    trend.set(monthKey(cursor), { auctionedMw: 0, awardedMw: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const auction of trendAuctions) {
    const item = trend.get(monthKey(auction.openAt));
    if (item) item.auctionedMw += number(auction.capacityMw);
  }
  for (const award of trendAwards) {
    if (!award.approvedAt) continue;
    const item = trend.get(monthKey(award.approvedAt));
    if (item) item.awardedMw += number(award.awardedCapacityMw);
  }

  return {
    filters: {
      from: query.from ?? null,
      to: query.to ?? null,
      organizationId: scopes.organizationId ?? null,
      technology: query.technology ?? null,
    },
    kpis: {
      activeAuctions,
      pendingAuctions,
      participantOrganizations: participantOrganizations.length,
      bidsReceived: bidSummary._count._all,
      contracts,
      activeContracts,
      auctionedMw: number(auctionCapacity._sum.capacityMw),
      offeredMw: number(bidSummary._sum.offeredPowerMw),
      awardedMw: number(approvedAwardSummary._sum.awardedCapacityMw),
      operationalMw: number(operationalProjects._sum.installedCapacityMw),
      operationalContractedMw: number(operationalProjects._sum.contractedCapacityMw),
      operationalProjects: operationalProjects._count._all,
      approvedAwards: approvedAwardSummary._count._all,
      expiringContracts: expiringContractCount,
    },
    capacityByTechnology: projectsByTechnology.map((item) => ({
      technology: item.renewableTechnologyCode,
      installedMw: number(item._sum.installedCapacityMw),
      contractedMw: number(item._sum.contractedCapacityMw),
    })),
    projectsByProvince: projectsByProvince.map((item) => ({
      province: item.province,
      projects: item._count._all,
      installedMw: number(item._sum.installedCapacityMw),
    })),
    auctionsByStatus: auctionsByStatus.map((item) => ({
      status: item.status,
      auctions: item._count._all,
      capacityMw: number(item._sum.capacityMw),
    })),
    averageAwardPriceByCurrency: [...averagePrices.entries()].map(([currency, item]) => ({
      currency,
      price: item.capacity ? item.weightedPrice / item.capacity : 0,
    })),
    contractedValueByCurrency: [...values.entries()].map(([currency, value]) => ({
      currency,
      value,
      contracts: currencyContracts.find((item) => item.currencyCode === currency)?._count._all ?? 0,
    })),
    trend: [...trend.entries()].map(([month, item]) => ({ month, ...item })),
    upcomingEvents,
    alerts: {
      closingAuctions,
      expiringContracts,
    },
    recentActivity,
  };
};
