import type { SessionUser } from '@ecosoft/shared';
import { analyticsOrganizationId, analyticsScopes } from './analytics-access';

const company: SessionUser = {
  id: 'e1862e69-b1cd-4269-a3b0-dc4ac5db8fe1',
  email: 'empresa@example.com',
  firstName: 'Ana',
  lastName: 'Empresa',
  organizationId: 'b4dc990a-7011-4701-acdd-3b416b17a7d8',
  authVersion: 0,
  roles: ['COMPANY_ADMIN'],
  permissions: ['analytics.read'],
};

describe('analytics access', () => {
  it('ignora filtros de otra organización para usuarios empresariales', () => {
    expect(
      analyticsOrganizationId(company, {
        organizationId: 'f26e2d9a-b03f-4a8b-8f25-ea0f9a8e0a8d',
      }),
    ).toBe(company.organizationId);
  });

  it('aplica el alcance empresarial a ofertas, proyectos y contratos', () => {
    const scopes = analyticsScopes(company, { technology: 'SOLAR' });
    expect(scopes.bid).toMatchObject({
      organizationId: company.organizationId,
      renewableTechnologyCode: 'SOLAR',
    });
    expect(scopes.project).toMatchObject({ organizationId: company.organizationId });
    expect(scopes.contract).toMatchObject({ organizationId: company.organizationId });
  });

  it('permite filtros institucionales explícitos', () => {
    const institutional = { ...company, organizationId: null, roles: ['CNE_ADMIN'] };
    const requested = 'f26e2d9a-b03f-4a8b-8f25-ea0f9a8e0a8d';
    expect(analyticsOrganizationId(institutional, { organizationId: requested })).toBe(requested);
  });
});
