import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { SessionUser } from '@ecosoft/shared';
import { AppError } from '../../common/app-error';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { tokenService } from './token.service';
import type { AuthResult, RequestMetadata } from './auth.types';

const userInclude = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userInclude }>;

const toSessionUser = (user: UserWithRoles): SessionUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  organizationId: user.organizationId,
  roles: user.roles.map(({ role }) => role.code),
  permissions: [
    ...new Set(
      user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)),
    ),
  ],
});

const expirationDate = (): Date => {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + env.REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
};

async function issueSession(
  user: UserWithRoles,
  metadata: RequestMetadata,
  familyId: string = randomUUID(),
): Promise<AuthResult> {
  const sessionUser = toSessionUser(user);
  const accessToken = tokenService.createAccessToken(sessionUser);
  const refresh = tokenService.createRefreshToken(user.id, familyId);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      familyId,
      jti: refresh.jti,
      tokenHash: tokenService.hash(refresh.token),
      expiresAt: expirationDate(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    },
  });

  return { accessToken, refreshToken: refresh.token, user: sessionUser };
}

export const authService = {
  async login(email: string, password: string, metadata: RequestMetadata): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: userInclude,
    });

    const denied = async (userId?: string, organizationId?: string): Promise<never> => {
      await auditService.record({
        userId,
        organizationId,
        action: 'LOGIN',
        module: 'Identity',
        result: 'DENIED',
        ...metadata,
      });
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
    };

    if (!user) return denied();
    if (user.lockedUntil && user.lockedUntil > new Date())
      return denied(user.id, user.organizationId ?? undefined);
    if (user.status !== 'ACTIVE') return denied(user.id, user.organizationId ?? undefined);

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts >= 5 ? 0 : attempts,
          lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      return denied(user.id, user.organizationId ?? undefined);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const result = await issueSession(user, metadata);
    await auditService.record({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: 'LOGIN',
      module: 'Identity',
      result: 'SUCCESS',
      ...metadata,
    });
    return result;
  },

  async refresh(rawToken: string, metadata: RequestMetadata): Promise<AuthResult> {
    const claims = tokenService.verifyRefreshToken(rawToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: tokenService.hash(rawToken) },
      include: { user: { include: userInclude } },
    });

    if (!stored || stored.userId !== claims.sub || stored.familyId !== claims.familyId) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'La sesión no es válida o expiró.');
    }
    if (stored.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppError(401, 'TOKEN_REUSE_DETECTED', 'La sesión fue revocada por seguridad.');
    }
    if (stored.expiresAt <= new Date() || stored.user.status !== 'ACTIVE') {
      throw new AppError(401, 'SESSION_EXPIRED', 'La sesión expiró.');
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return issueSession(stored.user, metadata, stored.familyId);
  },

  async logout(
    rawToken: string | undefined,
    user: SessionUser,
    metadata: RequestMetadata,
  ): Promise<void> {
    if (rawToken) {
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, tokenHash: tokenService.hash(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await auditService.record({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: 'LOGOUT',
      module: 'Identity',
      result: 'SUCCESS',
      ...metadata,
    });
  },
};
