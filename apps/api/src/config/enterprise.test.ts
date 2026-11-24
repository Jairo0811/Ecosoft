import { loadEnterpriseConfig } from './enterprise';

describe('enterprise configuration', () => {
  it('uses safe local defaults', () => {
    const config = loadEnterpriseConfig({});

    expect(config.edition).toBe('academic');
    expect(config.tenancyMode).toBe('dedicated');
    expect(config.identity.ssoProvider).toBe('local');
    expect(config.identity.mfaRequired).toBe(false);
    expect(config.security.hstsEnabled).toBe(false);
  });

  it('parses explicit enterprise flags', () => {
    const config = loadEnterpriseConfig({
      PRODUCT_EDITION: 'enterprise',
      INSTALLATION_ID: 'pilot-rd-01',
      INSTALLATION_NAME: 'EcoSoft Pilot',
      API_DOCS_ENABLED: 'false',
      SECURITY_HSTS_ENABLED: 'true',
      SECURITY_CSP_ENABLED: 'true',
      MFA_REQUIRED: 'true',
      TELEMETRY_ENABLED: 'true',
      WEBHOOKS_ENABLED: 'true',
      EMAIL_PROVIDER: 'external',
      SIGNATURE_PROVIDER: 'external',
    });

    expect(config.edition).toBe('enterprise');
    expect(config.apiDocsEnabled).toBe(false);
    expect(config.security).toEqual({ hstsEnabled: true, cspEnabled: true });
    expect(config.identity.mfaRequired).toBe(true);
    expect(config.integrations.telemetryEnabled).toBe(true);
    expect(config.integrations.webhooksEnabled).toBe(true);
  });

  it('fails fast when OIDC is enabled without its minimum configuration', () => {
    expect(() => loadEnterpriseConfig({ SSO_PROVIDER: 'oidc' })).toThrow(
      /OIDC_ISSUER_URL.*OIDC_CLIENT_ID/,
    );
  });

  it('accepts a configured OIDC provider', () => {
    const config = loadEnterpriseConfig({
      SSO_PROVIDER: 'oidc',
      OIDC_ISSUER_URL: 'https://login.example.com/tenant/v2.0',
      OIDC_CLIENT_ID: 'ecosoft-client',
    });

    expect(config.identity.ssoProvider).toBe('oidc');
    expect(config.identity.oidcClientId).toBe('ecosoft-client');
  });

  it('fails fast when SAML is enabled without an entrypoint', () => {
    expect(() => loadEnterpriseConfig({ SSO_PROVIDER: 'saml' })).toThrow(/SAML_ENTRYPOINT_URL/);
  });

  // Regression: `cp .env.example .env` left the API unable to start because the example file
  // declares OIDC_ISSUER_URL=, OIDC_CLIENT_ID= and SAML_ENTRYPOINT_URL= with empty values.
  it('treats the empty identity settings of .env.example as not configured', () => {
    const config = loadEnterpriseConfig({
      SSO_PROVIDER: 'local',
      OIDC_ISSUER_URL: '',
      OIDC_CLIENT_ID: '',
      SAML_ENTRYPOINT_URL: '  ',
    });

    expect(config.identity).toMatchObject({
      ssoProvider: 'local',
      oidcIssuerUrl: undefined,
      oidcClientId: undefined,
      samlEntrypointUrl: undefined,
    });
  });

  it('still fails fast when OIDC is selected and its settings are empty', () => {
    expect(() =>
      loadEnterpriseConfig({ SSO_PROVIDER: 'oidc', OIDC_ISSUER_URL: '', OIDC_CLIENT_ID: '' }),
    ).toThrow(/OIDC_ISSUER_URL es obligatorio.*OIDC_CLIENT_ID es obligatorio/);
  });

  it('still rejects a malformed identity URL', () => {
    expect(() =>
      loadEnterpriseConfig({ SSO_PROVIDER: 'saml', SAML_ENTRYPOINT_URL: 'not-a-url' }),
    ).toThrow(/SAML_ENTRYPOINT_URL/);
  });
});
