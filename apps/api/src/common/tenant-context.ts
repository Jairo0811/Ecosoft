import type { SessionUser } from '@ecosoft/shared';
import type { EnterpriseConfig } from '../config/enterprise';

export interface TenantContext {
  installationId: string;
  tenancyMode: EnterpriseConfig['tenancyMode'];
  scope: 'installation' | 'organization';
  organizationId: string | null;
}

/**
 * Derives the effective business scope exclusively from trusted server-side identity claims.
 * Request headers or query parameters must never override this context.
 */
export const resolveTenantContext = (
  user: Pick<SessionUser, 'organizationId'>,
  config: Pick<EnterpriseConfig, 'installationId' | 'tenancyMode'>,
): TenantContext => ({
  installationId: config.installationId,
  tenancyMode: config.tenancyMode,
  scope: user.organizationId ? 'organization' : 'installation',
  organizationId: user.organizationId,
});
