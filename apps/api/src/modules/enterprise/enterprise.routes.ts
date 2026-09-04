import { Router } from 'express';
import { enterpriseConfig } from '../../config/enterprise';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';

export const enterpriseRouter = Router();

enterpriseRouter.use(authenticate, requirePermission(permissions.auditRead));

enterpriseRouter.get('/capabilities', (_request, response) => {
  response.json({
    data: {
      edition: enterpriseConfig.edition,
      installationId: enterpriseConfig.installationId,
      installationName: enterpriseConfig.installationName,
      tenancyMode: enterpriseConfig.tenancyMode,
      apiDocsEnabled: enterpriseConfig.apiDocsEnabled,
      security: enterpriseConfig.security,
      identity: {
        mfaRequired: enterpriseConfig.identity.mfaRequired,
        ssoProvider: enterpriseConfig.identity.ssoProvider,
        configured:
          enterpriseConfig.identity.ssoProvider === 'local' ||
          (enterpriseConfig.identity.ssoProvider === 'oidc' &&
            Boolean(
              enterpriseConfig.identity.oidcIssuerUrl && enterpriseConfig.identity.oidcClientId,
            )) ||
          (enterpriseConfig.identity.ssoProvider === 'saml' &&
            Boolean(enterpriseConfig.identity.samlEntrypointUrl)),
      },
      integrations: enterpriseConfig.integrations,
    },
  });
});
