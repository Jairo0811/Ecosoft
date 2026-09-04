import type { EnterpriseConfig } from './enterprise';

export interface ReadinessFinding {
  code: string;
  severity: 'blocker' | 'warning';
  message: string;
}

export interface EnterpriseConfigurationReadiness {
  configurationReadyForProduction: boolean;
  findings: ReadinessFinding[];
}

/**
 * Evaluates only repository/runtime configuration. A successful result is NOT a production
 * certification: infrastructure drills, privacy review, load tests and pilot acceptance remain
 * external gates documented in docs/enterprise/.
 */
export const evaluateEnterpriseConfiguration = ({
  config,
  nodeEnv,
}: {
  config: EnterpriseConfig;
  nodeEnv: string;
}): EnterpriseConfigurationReadiness => {
  const findings: ReadinessFinding[] = [];

  if (config.edition !== 'enterprise') {
    findings.push({
      code: 'ENTERPRISE_EDITION_DISABLED',
      severity: 'blocker',
      message: 'PRODUCT_EDITION debe ser enterprise para un despliegue comercial.',
    });
  }
  if (nodeEnv !== 'production') {
    findings.push({
      code: 'NON_PRODUCTION_RUNTIME',
      severity: 'blocker',
      message: 'NODE_ENV debe ser production en el entorno productivo.',
    });
  }
  if (!config.security.hstsEnabled) {
    findings.push({
      code: 'HSTS_DISABLED',
      severity: 'blocker',
      message: 'HSTS debe habilitarse después de validar TLS en el borde.',
    });
  }
  if (!config.security.cspEnabled) {
    findings.push({
      code: 'CSP_DISABLED',
      severity: 'blocker',
      message: 'La política CSP debe estar habilitada y validada para producción.',
    });
  }
  if (!config.integrations.telemetryEnabled) {
    findings.push({
      code: 'TELEMETRY_DISABLED',
      severity: 'blocker',
      message: 'La telemetría operativa debe estar activa en producción.',
    });
  }
  if (config.integrations.emailProvider === 'console') {
    findings.push({
      code: 'TRANSACTIONAL_EMAIL_NOT_CONFIGURED',
      severity: 'blocker',
      message: 'El proveedor de correo de desarrollo no es válido para producción.',
    });
  }
  if (config.tenancyMode === 'shared') {
    findings.push({
      code: 'SHARED_TENANCY_REQUIRES_VALIDATION',
      severity: 'blocker',
      message:
        'El SaaS compartido requiere tenantId persistente y pruebas cross-tenant antes de producción.',
    });
  }

  if (config.apiDocsEnabled) {
    findings.push({
      code: 'API_DOCS_ENABLED',
      severity: 'warning',
      message: 'Confirme que la documentación API puede exponerse en esta instalación.',
    });
  }
  if (!config.identity.mfaRequired) {
    findings.push({
      code: 'MFA_NOT_REQUIRED',
      severity: 'warning',
      message: 'Evalúe exigir MFA según el riesgo y la política del cliente.',
    });
  }
  if (config.identity.ssoProvider === 'local') {
    findings.push({
      code: 'LOCAL_IDENTITY_ONLY',
      severity: 'warning',
      message: 'Evalúe OIDC/SAML si el cliente utiliza identidad empresarial centralizada.',
    });
  }
  if (config.integrations.signatureProvider === 'none') {
    findings.push({
      code: 'SIGNATURE_PROVIDER_NOT_CONFIGURED',
      severity: 'warning',
      message: 'Configure firma externa si el alcance contractual del cliente la requiere.',
    });
  }

  return {
    configurationReadyForProduction: !findings.some((finding) => finding.severity === 'blocker'),
    findings,
  };
};
