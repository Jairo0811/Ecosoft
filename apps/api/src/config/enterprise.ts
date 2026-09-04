import { z } from 'zod';

const booleanFromEnvironment = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return value;
}, z.boolean());

const enterpriseSchema = z
  .object({
    PRODUCT_EDITION: z.enum(['academic', 'enterprise']).default('academic'),
    INSTALLATION_ID: z.string().trim().min(2).max(80).default('local'),
    INSTALLATION_NAME: z.string().trim().min(2).max(160).default('EcoSoft'),
    TENANCY_MODE: z.enum(['dedicated', 'shared']).default('dedicated'),
    API_DOCS_ENABLED: booleanFromEnvironment.default(true),
    SECURITY_HSTS_ENABLED: booleanFromEnvironment.default(false),
    SECURITY_CSP_ENABLED: booleanFromEnvironment.default(false),
    MFA_REQUIRED: booleanFromEnvironment.default(false),
    SSO_PROVIDER: z.enum(['local', 'oidc', 'saml']).default('local'),
    OIDC_ISSUER_URL: z.string().url().optional(),
    OIDC_CLIENT_ID: z.string().trim().min(2).optional(),
    SAML_ENTRYPOINT_URL: z.string().url().optional(),
    TELEMETRY_ENABLED: booleanFromEnvironment.default(false),
    EMAIL_PROVIDER: z.enum(['console', 'external']).default('console'),
    WEBHOOKS_ENABLED: booleanFromEnvironment.default(false),
    SIGNATURE_PROVIDER: z.enum(['none', 'external']).default('none'),
  })
  .superRefine((value, context) => {
    if (value.SSO_PROVIDER === 'oidc') {
      if (!value.OIDC_ISSUER_URL) {
        context.addIssue({
          code: 'custom',
          path: ['OIDC_ISSUER_URL'],
          message: 'OIDC_ISSUER_URL es obligatorio cuando SSO_PROVIDER=oidc.',
        });
      }
      if (!value.OIDC_CLIENT_ID) {
        context.addIssue({
          code: 'custom',
          path: ['OIDC_CLIENT_ID'],
          message: 'OIDC_CLIENT_ID es obligatorio cuando SSO_PROVIDER=oidc.',
        });
      }
    }

    if (value.SSO_PROVIDER === 'saml' && !value.SAML_ENTRYPOINT_URL) {
      context.addIssue({
        code: 'custom',
        path: ['SAML_ENTRYPOINT_URL'],
        message: 'SAML_ENTRYPOINT_URL es obligatorio cuando SSO_PROVIDER=saml.',
      });
    }
  });

export type EnterpriseConfig = {
  edition: 'academic' | 'enterprise';
  installationId: string;
  installationName: string;
  tenancyMode: 'dedicated' | 'shared';
  apiDocsEnabled: boolean;
  security: {
    hstsEnabled: boolean;
    cspEnabled: boolean;
  };
  identity: {
    mfaRequired: boolean;
    ssoProvider: 'local' | 'oidc' | 'saml';
    oidcIssuerUrl?: string;
    oidcClientId?: string;
    samlEntrypointUrl?: string;
  };
  integrations: {
    telemetryEnabled: boolean;
    emailProvider: 'console' | 'external';
    webhooksEnabled: boolean;
    signatureProvider: 'none' | 'external';
  };
};

export const loadEnterpriseConfig = (source: NodeJS.ProcessEnv = process.env): EnterpriseConfig => {
  const result = enterpriseSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración Enterprise inválida: ${details}`);
  }

  const value = result.data;
  return {
    edition: value.PRODUCT_EDITION,
    installationId: value.INSTALLATION_ID,
    installationName: value.INSTALLATION_NAME,
    tenancyMode: value.TENANCY_MODE,
    apiDocsEnabled: value.API_DOCS_ENABLED,
    security: {
      hstsEnabled: value.SECURITY_HSTS_ENABLED,
      cspEnabled: value.SECURITY_CSP_ENABLED,
    },
    identity: {
      mfaRequired: value.MFA_REQUIRED,
      ssoProvider: value.SSO_PROVIDER,
      oidcIssuerUrl: value.OIDC_ISSUER_URL,
      oidcClientId: value.OIDC_CLIENT_ID,
      samlEntrypointUrl: value.SAML_ENTRYPOINT_URL,
    },
    integrations: {
      telemetryEnabled: value.TELEMETRY_ENABLED,
      emailProvider: value.EMAIL_PROVIDER,
      webhooksEnabled: value.WEBHOOKS_ENABLED,
      signatureProvider: value.SIGNATURE_PROVIDER,
    },
  };
};

export const enterpriseConfig = loadEnterpriseConfig();
