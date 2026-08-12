import type { SessionUser } from '@ecosoft/shared';
import { AppError } from '../../common/app-error';

export const systemRoleCodes = [
  'SUPER_ADMIN',
  'CNE_ADMIN',
  'AUCTION_MANAGER',
  'TECHNICAL_EVALUATOR',
  'FINANCIAL_EVALUATOR',
  'REGULATORY_SUPERVISOR',
  'AUDITOR',
  'COMPANY_ADMIN',
  'COMPANY_REPRESENTATIVE',
  'READ_ONLY',
] as const;

const companyRoleCodes = ['COMPANY_ADMIN', 'COMPANY_REPRESENTATIVE', 'READ_ONLY'] as const;

export const allowedRoleCodes = (actor: SessionUser): string[] => {
  if (actor.roles.includes('SUPER_ADMIN')) return [...systemRoleCodes];
  if (actor.roles.includes('CNE_ADMIN')) {
    return systemRoleCodes.filter((code) => code !== 'SUPER_ADMIN');
  }
  if (actor.roles.includes('COMPANY_ADMIN')) return [...companyRoleCodes];
  return [];
};

export const assertCanManageOrganization = (
  actor: SessionUser,
  organizationId: string | null,
): void => {
  if (actor.roles.some((role) => role === 'SUPER_ADMIN' || role === 'CNE_ADMIN')) return;
  if (
    actor.roles.includes('COMPANY_ADMIN') &&
    actor.organizationId &&
    actor.organizationId === organizationId
  ) {
    return;
  }
  throw new AppError(
    403,
    'ORGANIZATION_SCOPE_VIOLATION',
    'No puede administrar usuarios de esta organización.',
  );
};

export const assertRolesAllowed = (actor: SessionUser, roleCodes: string[]): void => {
  const allowed = new Set(allowedRoleCodes(actor));
  if (roleCodes.some((roleCode) => !allowed.has(roleCode))) {
    throw new AppError(
      403,
      'ROLE_SCOPE_VIOLATION',
      'Uno o más roles exceden su ámbito de administración.',
    );
  }
};

export const scopedOrganizationId = (actor: SessionUser): string | undefined =>
  actor.roles.includes('COMPANY_ADMIN') ? (actor.organizationId ?? undefined) : undefined;
