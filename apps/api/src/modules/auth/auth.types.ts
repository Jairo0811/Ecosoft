import type { SessionUser } from '@ecosoft/shared';

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}
