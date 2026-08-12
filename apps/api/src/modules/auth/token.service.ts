import { createHash, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { SessionUser } from '@ecosoft/shared';
import { env } from '../../config/env';
import { AppError } from '../../common/app-error';

interface AccessClaims extends JwtPayload {
  type: 'access';
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string | null;
  authVersion: number;
  roles: string[];
  permissions: string[];
}

interface RefreshClaims extends JwtPayload {
  type: 'refresh';
  familyId: string;
}

const commonOptions = { issuer: 'ecosoft-api', audience: 'ecosoft-web' } as const;

export const tokenService = {
  createAccessToken(user: SessionUser): string {
    return jwt.sign(
      {
        type: 'access',
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
        authVersion: user.authVersion,
        roles: user.roles,
        permissions: user.permissions,
      } satisfies Omit<AccessClaims, keyof JwtPayload>,
      env.JWT_ACCESS_SECRET,
      {
        ...commonOptions,
        subject: user.id,
        expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
        jwtid: randomUUID(),
      },
    );
  },

  createRefreshToken(userId: string, familyId: string): { token: string; jti: string } {
    const jti = randomUUID();
    const token = jwt.sign(
      { type: 'refresh', familyId } satisfies Omit<RefreshClaims, keyof JwtPayload>,
      env.JWT_REFRESH_SECRET,
      {
        ...commonOptions,
        subject: userId,
        expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
        jwtid: jti,
      },
    );
    return { token, jti };
  },

  verifyAccessToken(token: string): SessionUser {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, commonOptions) as AccessClaims;
      if (payload.type !== 'access' || !payload.sub) throw new Error('Invalid access claims');
      return {
        id: payload.sub,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        organizationId: payload.organizationId,
        authVersion: payload.authVersion,
        roles: payload.roles,
        permissions: payload.permissions,
      };
    } catch {
      throw new AppError(401, 'INVALID_TOKEN', 'El token de acceso no es válido o expiró.');
    }
  },

  verifyRefreshToken(token: string): RefreshClaims {
    try {
      const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, commonOptions) as RefreshClaims;
      if (payload.type !== 'refresh' || !payload.sub || !payload.jti || !payload.familyId) {
        throw new Error('Invalid refresh claims');
      }
      return payload;
    } catch {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'La sesión no es válida o expiró.');
    }
  },

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  },
};
