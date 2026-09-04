import { resolveTenantContext } from './tenant-context';

describe('resolveTenantContext', () => {
  const config = { installationId: 'pilot-rd-01', tenancyMode: 'dedicated' as const };

  it('scopes company users to their organization', () => {
    expect(resolveTenantContext({ organizationId: 'org-123' }, config)).toEqual({
      installationId: 'pilot-rd-01',
      tenancyMode: 'dedicated',
      scope: 'organization',
      organizationId: 'org-123',
    });
  });

  it('keeps institutional users at installation scope', () => {
    expect(resolveTenantContext({ organizationId: null }, config)).toEqual({
      installationId: 'pilot-rd-01',
      tenancyMode: 'dedicated',
      scope: 'installation',
      organizationId: null,
    });
  });
});
