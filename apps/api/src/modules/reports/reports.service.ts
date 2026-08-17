import type { SessionUser } from '@ecosoft/shared';
import { AppError } from '../../common/app-error';
import { prisma } from '../../config/prisma';
import { analyticsScopes, hasInstitutionalAnalyticsAccess } from '../analytics/analytics-access';
import type { ReportRow } from './report-export';
import type { ReportQuery, ReportType } from './reports.schemas';

export interface ReportData {
  title: string;
  columns: string[];
  rows: ReportRow[];
}

const iso = (value: Date | null): string => value?.toISOString() ?? '';
const number = (value: unknown): number => (value == null ? 0 : Number(value));

export const getReport = async (
  type: ReportType,
  actor: SessionUser,
  query: ReportQuery,
): Promise<ReportData> => {
  const scopes = analyticsScopes(actor, query);
  const limit = 10_000;
  switch (type) {
    case 'auctions': {
      const data = await prisma.auction.findMany({
        where: { ...scopes.auction, ...(query.status ? { status: query.status } : {}) },
        orderBy: { openAt: 'desc' },
        take: limit,
        select: {
          code: true,
          title: true,
          status: true,
          renewableTechnologyCode: true,
          capacityMw: true,
          maximumPrice: true,
          currencyCode: true,
          openAt: true,
          closeAt: true,
          _count: { select: { participants: true, bids: true, awards: true } },
        },
      });
      return {
        title: 'Reporte de subastas',
        columns: [
          'Código',
          'Título',
          'Estado',
          'Tecnología',
          'MW licitados',
          'Precio máximo',
          'Moneda',
          'Apertura UTC',
          'Cierre UTC',
          'Participantes',
          'Ofertas',
          'Adjudicaciones',
        ],
        rows: data.map((item) => ({
          Código: item.code,
          Título: item.title,
          Estado: item.status,
          Tecnología: item.renewableTechnologyCode,
          'MW licitados': number(item.capacityMw),
          'Precio máximo': number(item.maximumPrice),
          Moneda: item.currencyCode,
          'Apertura UTC': iso(item.openAt),
          'Cierre UTC': iso(item.closeAt),
          Participantes: item._count.participants,
          Ofertas: item._count.bids,
          Adjudicaciones: item._count.awards,
        })),
      };
    }
    case 'participants': {
      const data = await prisma.organization.findMany({
        where: {
          ...(scopes.organizationId ? { id: scopes.organizationId } : {}),
          ...(query.status ? { status: query.status } : {}),
          auctionParticipations: { some: { auction: scopes.auction } },
        },
        orderBy: { legalName: 'asc' },
        take: limit,
        select: {
          rnc: true,
          legalName: true,
          commercialName: true,
          type: true,
          status: true,
          createdAt: true,
          _count: { select: { auctionParticipations: true, bids: true, ppaContracts: true } },
        },
      });
      return {
        title: 'Reporte de participantes',
        columns: [
          'RNC',
          'Razón social',
          'Nombre comercial',
          'Tipo',
          'Estado',
          'Registro UTC',
          'Subastas',
          'Ofertas',
          'Contratos',
        ],
        rows: data.map((item) => ({
          RNC: item.rnc,
          'Razón social': item.legalName,
          'Nombre comercial': item.commercialName,
          Tipo: item.type,
          Estado: item.status,
          'Registro UTC': iso(item.createdAt),
          Subastas: item._count.auctionParticipations,
          Ofertas: item._count.bids,
          Contratos: item._count.ppaContracts,
        })),
      };
    }
    case 'bids': {
      const data = await prisma.bid.findMany({
        where: { ...scopes.bid, ...(query.status ? { status: query.status } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          auction: { select: { code: true } },
          organization: { select: { legalName: true } },
          projectName: true,
          renewableTechnologyCode: true,
          status: true,
          offeredPowerMw: true,
          estimatedEnergyMwh: true,
          offeredPrice: true,
          currencyCode: true,
          submittedAt: true,
        },
      });
      return {
        title: 'Reporte de ofertas',
        columns: [
          'Subasta',
          'Empresa',
          'Proyecto',
          'Tecnología',
          'Estado',
          'MW ofertados',
          'MWh estimados',
          'Precio',
          'Moneda',
          'Envío UTC',
        ],
        rows: data.map((item) => ({
          Subasta: item.auction.code,
          Empresa: item.organization.legalName,
          Proyecto: item.projectName,
          Tecnología: item.renewableTechnologyCode,
          Estado: item.status,
          'MW ofertados': number(item.offeredPowerMw),
          'MWh estimados': number(item.estimatedEnergyMwh),
          Precio: number(item.offeredPrice),
          Moneda: item.currencyCode,
          'Envío UTC': iso(item.submittedAt),
        })),
      };
    }
    case 'awards': {
      const data = await prisma.award.findMany({
        where: {
          bid: scopes.bid,
          ...(query.status ? { status: query.status } : {}),
          ...(query.from || query.to ? { approvedAt: { gte: query.from, lte: query.to } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          resolutionNumber: true,
          status: true,
          awardedPrice: true,
          awardedCapacityMw: true,
          approvedAt: true,
          auction: { select: { code: true, currencyCode: true } },
          bid: { select: { projectName: true, organization: { select: { legalName: true } } } },
        },
      });
      return {
        title: 'Reporte de adjudicaciones',
        columns: [
          'Resolución',
          'Subasta',
          'Empresa',
          'Proyecto',
          'Estado',
          'MW adjudicados',
          'Precio',
          'Moneda',
          'Aprobación UTC',
        ],
        rows: data.map((item) => ({
          Resolución: item.resolutionNumber,
          Subasta: item.auction.code,
          Empresa: item.bid.organization.legalName,
          Proyecto: item.bid.projectName,
          Estado: item.status,
          'MW adjudicados': number(item.awardedCapacityMw),
          Precio: number(item.awardedPrice),
          Moneda: item.auction.currencyCode,
          'Aprobación UTC': iso(item.approvedAt),
        })),
      };
    }
    case 'contracts': {
      const data = await prisma.pPAContract.findMany({
        where: { ...scopes.contract, ...(query.status ? { status: query.status } : {}) },
        orderBy: { endDate: 'asc' },
        take: limit,
        select: {
          contractNumber: true,
          status: true,
          startDate: true,
          endDate: true,
          price: true,
          currencyCode: true,
          capacityMw: true,
          committedEnergyMwh: true,
          organization: { select: { legalName: true } },
          project: { select: { name: true, renewableTechnologyCode: true } },
        },
      });
      return {
        title: 'Reporte de contratos PPA',
        columns: [
          'Contrato',
          'Empresa',
          'Proyecto',
          'Tecnología',
          'Estado',
          'MW',
          'MWh comprometidos',
          'Precio',
          'Moneda',
          'Inicio UTC',
          'Vencimiento UTC',
        ],
        rows: data.map((item) => ({
          Contrato: item.contractNumber,
          Empresa: item.organization.legalName,
          Proyecto: item.project.name,
          Tecnología: item.project.renewableTechnologyCode,
          Estado: item.status,
          MW: number(item.capacityMw),
          'MWh comprometidos': number(item.committedEnergyMwh),
          Precio: number(item.price),
          Moneda: item.currencyCode,
          'Inicio UTC': iso(item.startDate),
          'Vencimiento UTC': iso(item.endDate),
        })),
      };
    }
    case 'projects': {
      const data = await prisma.energyProject.findMany({
        where: { ...scopes.project, ...(query.status ? { status: query.status } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          name: true,
          renewableTechnologyCode: true,
          province: true,
          municipality: true,
          installedCapacityMw: true,
          contractedCapacityMw: true,
          status: true,
          actualOperationDate: true,
          organization: { select: { legalName: true } },
        },
      });
      return {
        title: 'Reporte de proyectos energéticos',
        columns: [
          'Proyecto',
          'Empresa',
          'Tecnología',
          'Provincia',
          'Municipio',
          'Estado',
          'MW instalados',
          'MW contratados',
          'Operación real UTC',
        ],
        rows: data.map((item) => ({
          Proyecto: item.name,
          Empresa: item.organization.legalName,
          Tecnología: item.renewableTechnologyCode,
          Provincia: item.province,
          Municipio: item.municipality,
          Estado: item.status,
          'MW instalados': number(item.installedCapacityMw),
          'MW contratados': number(item.contractedCapacityMw),
          'Operación real UTC': iso(item.actualOperationDate),
        })),
      };
    }
    case 'capacity': {
      const [auctions, bids, awards, projects] = await Promise.all([
        prisma.auction.groupBy({
          by: ['renewableTechnologyCode'],
          where: scopes.auction,
          _sum: { capacityMw: true },
        }),
        prisma.bid.groupBy({
          by: ['renewableTechnologyCode'],
          where: scopes.bid,
          _sum: { offeredPowerMw: true },
        }),
        prisma.award.findMany({
          where: { status: 'APROBADA', bid: scopes.bid },
          select: {
            awardedCapacityMw: true,
            bid: { select: { renewableTechnologyCode: true } },
          },
        }),
        prisma.energyProject.groupBy({
          by: ['renewableTechnologyCode'],
          where: { ...scopes.project, status: 'OPERATIVO' },
          _sum: { installedCapacityMw: true },
        }),
      ]);
      const technologies = new Set([
        ...auctions.map((item) => item.renewableTechnologyCode),
        ...bids.map((item) => item.renewableTechnologyCode),
        ...awards.map((item) => item.bid.renewableTechnologyCode),
        ...projects.map((item) => item.renewableTechnologyCode),
      ]);
      return {
        title: 'Reporte de capacidad energética',
        columns: ['Tecnología', 'MW licitados', 'MW ofertados', 'MW adjudicados', 'MW operativos'],
        rows: [...technologies].sort().map((technology) => ({
          Tecnología: technology,
          'MW licitados': number(
            auctions.find((item) => item.renewableTechnologyCode === technology)?._sum.capacityMw,
          ),
          'MW ofertados': number(
            bids.find((item) => item.renewableTechnologyCode === technology)?._sum.offeredPowerMw,
          ),
          'MW adjudicados': awards
            .filter((item) => item.bid.renewableTechnologyCode === technology)
            .reduce((sum, item) => sum + number(item.awardedCapacityMw), 0),
          'MW operativos': number(
            projects.find((item) => item.renewableTechnologyCode === technology)?._sum
              .installedCapacityMw,
          ),
        })),
      };
    }
    case 'audit': {
      if (!hasInstitutionalAnalyticsAccess(actor) || !actor.permissions.includes('audit.read')) {
        throw new AppError(
          403,
          'AUDIT_REPORT_FORBIDDEN',
          'No tiene acceso al reporte de auditoría.',
        );
      }
      const data = await prisma.auditLog.findMany({
        where: {
          ...(scopes.organizationId ? { organizationId: scopes.organizationId } : {}),
          ...(query.from || query.to ? { createdAt: { gte: query.from, lte: query.to } } : {}),
          ...(query.status ? { result: query.status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          createdAt: true,
          action: true,
          module: true,
          entity: true,
          entityId: true,
          result: true,
          correlationId: true,
          user: { select: { email: true } },
        },
      });
      return {
        title: 'Reporte de auditoría',
        columns: [
          'Fecha UTC',
          'Usuario',
          'Acción',
          'Módulo',
          'Entidad',
          'EntityId',
          'Resultado',
          'CorrelationId',
        ],
        rows: data.map((item) => ({
          'Fecha UTC': iso(item.createdAt),
          Usuario: item.user?.email ?? 'Sistema',
          Acción: item.action,
          Módulo: item.module,
          Entidad: item.entity,
          EntityId: item.entityId,
          Resultado: item.result,
          CorrelationId: item.correlationId,
        })),
      };
    }
  }
};
