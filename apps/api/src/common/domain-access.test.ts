import type { SessionUser } from '@ecosoft/shared';
import {
  assertOrganizationScope,
  hasInstitutionalAccess,
  requireOrganization,
} from './domain-access';

const actor = (roles: string[], organizationId: string | null): SessionUser => ({
  id: '8a769e7d-5169-4146-9fea-718bd4810f89',
  email: 'user@example.com',
  firstName: 'Test',
  lastName: 'User',
  organizationId,
  roles,
  permissions: [],
  authVersion: 0,
});

describe('domain access', () => {
  it('recognizes institutional roles', () => {
    expect(hasInstitutionalAccess(actor(['CNE_ADMIN'], null))).toBe(true);
    expect(hasInstitutionalAccess(actor(['COMPANY_ADMIN'], 'company-a'))).toBe(false);
  });

  it('conceals cross-organization resources', () => {
    expect(() =>
      assertOrganizationScope(actor(['COMPANY_ADMIN'], 'company-a'), 'company-b'),
    ).toThrow('no existe o no está disponible');
    expect(() =>
      assertOrganizationScope(actor(['COMPANY_ADMIN'], 'company-a'), 'company-a'),
    ).not.toThrow();
  });

  it('requires an organization for company operations', () => {
    expect(() => requireOrganization(actor(['COMPANY_REPRESENTATIVE'], null))).toThrow(
      'requiere una organización',
    );
  });
});
