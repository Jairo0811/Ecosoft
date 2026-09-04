import { evaluateEnterpriseConfiguration } from './enterprise-readiness';
import { loadEnterpriseConfig } from './enterprise';

describe('enterprise configuration readiness', () => {
  it('blocks the academic development defaults', () => {
    const result = evaluateEnterpriseConfiguration({
      config: loadEnterpriseConfig({}),
      nodeEnv: 'development',
    });

    expect(result.configurationReadyForProduction).toBe(false);
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'ENTERPRISE_EDITION_DISABLED',
        'NON_PRODUCTION_RUNTIME',
        'HSTS_DISABLED',
        'CSP_DISABLED',
        'TELEMETRY_DISABLED',
        'TRANSACTIONAL_EMAIL_NOT_CONFIGURED',
      ]),
    );
  });

  it('can pass repository configuration gates for a dedicated enterprise installation', () => {
    const config = loadEnterpriseConfig({
      PRODUCT_EDITION: 'enterprise',
      INSTALLATION_ID: 'customer-01',
      INSTALLATION_NAME: 'EcoSoft Customer 01',
      API_DOCS_ENABLED: 'false',
      SECURITY_HSTS_ENABLED: 'true',
      SECURITY_CSP_ENABLED: 'true',
      MFA_REQUIRED: 'true',
      SSO_PROVIDER: 'oidc',
      OIDC_ISSUER_URL: 'https://login.example.com/tenant/v2.0',
      OIDC_CLIENT_ID: 'ecosoft-client',
      TELEMETRY_ENABLED: 'true',
      EMAIL_PROVIDER: 'external',
      TENANCY_MODE: 'dedicated',
    });

    const result = evaluateEnterpriseConfiguration({ config, nodeEnv: 'production' });

    expect(result.configurationReadyForProduction).toBe(true);
    expect(result.findings.some((finding) => finding.severity === 'blocker')).toBe(false);
  });

  it('blocks shared tenancy until cross-tenant persistence and validation exist', () => {
    const config = loadEnterpriseConfig({
      PRODUCT_EDITION: 'enterprise',
      SECURITY_HSTS_ENABLED: 'true',
      SECURITY_CSP_ENABLED: 'true',
      TELEMETRY_ENABLED: 'true',
      EMAIL_PROVIDER: 'external',
      TENANCY_MODE: 'shared',
    });

    const result = evaluateEnterpriseConfiguration({ config, nodeEnv: 'production' });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SHARED_TENANCY_REQUIRES_VALIDATION',
          severity: 'blocker',
        }),
      ]),
    );
  });
});
