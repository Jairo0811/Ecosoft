import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@ecosoft/shared';
import bcrypt from 'bcryptjs';
import { AppError } from '../../common/app-error';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { tokenService } from '../auth/token.service';
import type { RequestMetadata } from '../auth/auth.types';
import { assertCanManageOrganization, assertRolesAllowed } from './user-access';

interface InvitationInput {
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  roleCodes: string[];
}

const invitationInclude = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      organization: { select: { id: true, legalName: true, commercialName: true } },
      roles: { select: { role: { select: { code: true, name: true } } } },
    },
  },
  invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.UserInvitationInclude;

const getValidInvitation = async (rawToken: string) => {
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash: tokenService.hash(rawToken) },
    include: invitationInclude,
  });
  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.revokedAt ||
    invitation.expiresAt <= new Date() ||
    invitation.user.status !== 'INVITED'
  ) {
    throw new AppError(
      410,
      'INVITATION_INVALID',
      'La invitación no existe, expiró o ya fue utilizada.',
    );
  }
  return invitation;
};

export const invitationService = {
  async create(
    input: InvitationInput,
    actor: SessionUser,
    metadata: RequestMetadata,
  ): Promise<Record<string, unknown>> {
    assertCanManageOrganization(actor, input.organizationId);
    assertRolesAllowed(actor, input.roleCodes);

    const organization = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, status: true, legalName: true },
    });
    if (!organization) {
      throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'La organización no existe.');
    }
    if (organization.status !== 'APPROVED') {
      throw new AppError(
        409,
        'ORGANIZATION_NOT_APPROVED',
        'Solo puede invitar usuarios a organizaciones aprobadas.',
      );
    }

    const roles = await prisma.role.findMany({
      where: { code: { in: [...new Set(input.roleCodes)] } },
      select: { id: true, code: true },
    });
    if (roles.length !== new Set(input.roleCodes).size) {
      throw new AppError(400, 'INVALID_ROLE', 'Uno o más roles no existen.');
    }

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        status: true,
        organizationId: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    });
    if (existing && existing.status !== 'INVITED') {
      throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'El correo ya pertenece a un usuario.');
    }
    if (existing) {
      assertCanManageOrganization(actor, existing.organizationId);
      assertRolesAllowed(
        actor,
        existing.roles.map(({ role }) => role.code),
      );
    }

    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + env.INVITATION_TTL_HOURS * 60 * 60 * 1000);
    const placeholderHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const invitation = await prisma.$transaction(async (transaction) => {
      const user = existing
        ? await transaction.user.update({
            where: { id: existing.id },
            data: {
              firstName: input.firstName,
              lastName: input.lastName,
              organizationId: input.organizationId,
              passwordHash: placeholderHash,
              authVersion: { increment: 1 },
              roles: {
                deleteMany: {},
                create: roles.map((role) => ({ roleId: role.id })),
              },
            },
          })
        : await transaction.user.create({
            data: {
              email: input.email,
              firstName: input.firstName,
              lastName: input.lastName,
              organizationId: input.organizationId,
              passwordHash: placeholderHash,
              status: 'INVITED',
              roles: { create: roles.map((role) => ({ roleId: role.id })) },
            },
          });
      await transaction.userInvitation.updateMany({
        where: { userId: user.id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return transaction.userInvitation.create({
        data: {
          email: input.email,
          tokenHash: tokenService.hash(rawToken),
          userId: user.id,
          invitedByUserId: actor.id,
          expiresAt,
        },
        include: invitationInclude,
      });
    });

    await auditService.record({
      userId: actor.id,
      organizationId: input.organizationId,
      action: existing ? 'REINVITE' : 'INVITE',
      module: 'USERS',
      entity: 'UserInvitation',
      entityId: invitation.id,
      result: 'SUCCESS',
      ...metadata,
      newValues: { email: input.email, roleCodes: roles.map((role) => role.code), expiresAt },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      user: invitation.user,
      invitedBy: invitation.invitedBy,
      delivery: env.NODE_ENV === 'production' ? 'PENDING_EMAIL_PROVIDER' : 'DEVELOPMENT_LINK',
      ...(env.NODE_ENV === 'production'
        ? {}
        : { activationUrl: `${env.WEB_ORIGIN}/activar-cuenta?token=${rawToken}` }),
    };
  },

  async validate(rawToken: string) {
    const invitation = await getValidInvitation(rawToken);
    return {
      email: invitation.user.email,
      firstName: invitation.user.firstName,
      lastName: invitation.user.lastName,
      organization: invitation.user.organization,
      roles: invitation.user.roles.map(({ role }) => role),
      expiresAt: invitation.expiresAt,
    };
  },

  async accept(rawToken: string, password: string, metadata: RequestMetadata): Promise<void> {
    const invitation = await getValidInvitation(rawToken);
    const passwordHash = await bcrypt.hash(password, 12);
    const acceptedAt = new Date();
    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.userInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: acceptedAt },
        },
        data: { acceptedAt },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          410,
          'INVITATION_INVALID',
          'La invitación no existe, expiró o ya fue utilizada.',
        );
      }
      await transaction.user.update({
        where: { id: invitation.userId },
        data: {
          passwordHash,
          status: 'ACTIVE',
          emailConfirmedAt: acceptedAt,
          failedLoginAttempts: 0,
          lockedUntil: null,
          authVersion: { increment: 1 },
        },
      });
      await transaction.userInvitation.updateMany({
        where: { userId: invitation.userId, id: { not: invitation.id }, revokedAt: null },
        data: { revokedAt: acceptedAt },
      });
      await transaction.refreshToken.updateMany({
        where: { userId: invitation.userId, revokedAt: null },
        data: { revokedAt: acceptedAt },
      });
    });
    await auditService.record({
      userId: invitation.userId,
      organizationId: invitation.user.organization?.id,
      action: 'ACTIVATE_ACCOUNT',
      module: 'IDENTITY',
      entity: 'User',
      entityId: invitation.userId,
      result: 'SUCCESS',
      ...metadata,
    });
  },
};
