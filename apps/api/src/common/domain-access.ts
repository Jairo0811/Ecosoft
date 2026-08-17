import type { SessionUser } from '@ecosoft/shared';
import { AppError } from './app-error';

const institutionalRoles = new Set([
  'SUPER_ADMIN',
  'CNE_ADMIN',
  'AUCTION_MANAGER',
  'TECHNICAL_EVALUATOR',
  'FINANCIAL_EVALUATOR',
  'REGULATORY_SUPERVISOR',
  'AUDITOR',
]);

export const hasInstitutionalAccess = (actor: SessionUser): boolean =>
  actor.roles.some((role) => institutionalRoles.has(role));

export const requireOrganization = (actor: SessionUser): string => {
  if (!actor.organizationId) {
    throw new AppError(403, 'ORGANIZATION_REQUIRED', 'La operación requiere una organización.');
  }
  return actor.organizationId;
};

export const assertOrganizationScope = (actor: SessionUser, organizationId: string): void => {
  if (!hasInstitutionalAccess(actor) && actor.organizationId !== organizationId) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'El recurso no existe o no está disponible.');
  }
};
