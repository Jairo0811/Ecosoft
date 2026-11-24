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

/**
 * Scope value for actors without an organization that must see no organization-owned rows.
 * It is a syntactically valid UNIQUEIDENTIFIER (the nil UUID, never assigned to a real row):
 * a non-UUID sentinel such as '__none__' makes SQL Server fail the conversion with HTTP 500
 * instead of returning an empty result.
 */
export const NO_ORGANIZATION_SCOPE = '00000000-0000-0000-0000-000000000000';

/** Organization filter value for a non-institutional actor (fails closed when absent). */
export const organizationScopeId = (actor: SessionUser): string =>
  actor.organizationId ?? NO_ORGANIZATION_SCOPE;
