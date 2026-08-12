import type { SessionUser } from '@ecosoft/shared';
import { allowedRoleCodes, assertCanManageOrganization, assertRolesAllowed } from './user-access';

const actor = (roles: string[], organizationId: string | null = null): SessionUser => ({
  id: 'user-id',
  email: 'user@example.com',
  firstName: 'Test',
  lastName: 'User',
  organizationId,
  authVersion: 0,
  roles,
  permissions: ['users.manage'],
});

describe('user access policy', () => {
  it('reserves SUPER_ADMIN assignment for super administrators', () => {
    expect(allowedRoleCodes(actor(['SUPER_ADMIN']))).toContain('SUPER_ADMIN');
    expect(allowedRoleCodes(actor(['CNE_ADMIN']))).not.toContain('SUPER_ADMIN');
    expect(() => assertRolesAllowed(actor(['CNE_ADMIN']), ['SUPER_ADMIN'])).toThrow(
      /ámbito de administración/,
    );
  });

  it('limits company administrators to business roles', () => {
    expect(allowedRoleCodes(actor(['COMPANY_ADMIN'], 'org-1'))).toEqual([
      'COMPANY_ADMIN',
      'COMPANY_REPRESENTATIVE',
      'READ_ONLY',
    ]);
    expect(() => assertRolesAllowed(actor(['COMPANY_ADMIN'], 'org-1'), ['CNE_ADMIN'])).toThrow(
      /ámbito de administración/,
    );
  });

  it('limits company administrators to their organization', () => {
    expect(() =>
      assertCanManageOrganization(actor(['COMPANY_ADMIN'], 'org-1'), 'org-1'),
    ).not.toThrow();
    expect(() => assertCanManageOrganization(actor(['COMPANY_ADMIN'], 'org-1'), 'org-2')).toThrow(
      /esta organización/,
    );
  });
});
