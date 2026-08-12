import type { Prisma } from '@prisma/client';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { invitationService } from './invitations.service';
import {
  assertCanManageOrganization,
  assertRolesAllowed,
  scopedOrganizationId,
} from './user-access';
import {
  createInvitationSchema,
  invitationQuerySchema,
  userQuerySchema,
  userRolesSchema,
  userStatusSchema,
} from './users.schemas';

const router = Router();
const parseId = (value: string | string[] | undefined) => z.uuid().parse(value);
const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, commercialName: true, legalName: true } },
  roles: { select: { role: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.UserSelect;

const getManagedUser = async (id: string, actor: NonNullable<Request['auth']>) => {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'El usuario no existe.');
  assertCanManageOrganization(actor, user.organization?.id ?? null);
  assertRolesAllowed(
    actor,
    user.roles.map(({ role }) => role.code),
  );
  return user;
};

router.get(
  '/',
  authenticate,
  requirePermission(permissions.usersManage),
  asyncHandler(async (request, response) => {
    const query = userQuerySchema.parse(request.query);
    const organizationId = scopedOrganizationId(request.auth!);
    if (request.auth!.roles.includes('COMPANY_ADMIN') && !organizationId) {
      throw new AppError(403, 'ORGANIZATION_SCOPE_REQUIRED', 'Su usuario no tiene organización.');
    }
    const where: Prisma.UserWhereInput = {
      ...(organizationId
        ? { organizationId }
        : query.organizationId
          ? { organizationId: query.organizationId }
          : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q } },
              { firstName: { contains: query.q } },
              { lastName: { contains: query.q } },
            ],
          }
        : {}),
    };
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    response.json({
      data: users,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  }),
);

router.get(
  '/invitations',
  authenticate,
  requirePermission(permissions.usersManage),
  asyncHandler(async (request, response) => {
    const query = invitationQuerySchema.parse(request.query);
    const organizationId = scopedOrganizationId(request.auth!);
    if (request.auth!.roles.includes('COMPANY_ADMIN') && !organizationId) {
      throw new AppError(403, 'ORGANIZATION_SCOPE_REQUIRED', 'Su usuario no tiene organización.');
    }
    const now = new Date();
    const statusWhere: Prisma.UserInvitationWhereInput =
      query.status === 'ACCEPTED'
        ? { acceptedAt: { not: null } }
        : query.status === 'REVOKED'
          ? { revokedAt: { not: null } }
          : query.status === 'EXPIRED'
            ? { acceptedAt: null, revokedAt: null, expiresAt: { lte: now } }
            : query.status === 'PENDING'
              ? { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }
              : {};
    const where: Prisma.UserInvitationWhereInput = {
      ...statusWhere,
      user: {
        ...(organizationId ? { organizationId } : {}),
        ...(query.q
          ? {
              OR: [
                { email: { contains: query.q } },
                { firstName: { contains: query.q } },
                { lastName: { contains: query.q } },
              ],
            }
          : {}),
      },
    };
    const [invitations, total] = await prisma.$transaction([
      prisma.userInvitation.findMany({
        where,
        select: {
          id: true,
          email: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              organization: { select: { id: true, legalName: true, commercialName: true } },
              roles: { select: { role: { select: { code: true, name: true } } } },
            },
          },
          invitedBy: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.userInvitation.count({ where }),
    ]);
    response.json({
      data: invitations.map((invitation) => ({
        ...invitation,
        status: invitation.acceptedAt
          ? 'ACCEPTED'
          : invitation.revokedAt
            ? 'REVOKED'
            : invitation.expiresAt <= now
              ? 'EXPIRED'
              : 'PENDING',
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  }),
);

router.post(
  '/invitations',
  authenticate,
  requirePermission(permissions.usersManage),
  asyncHandler(async (request, response) => {
    const input = createInvitationSchema.parse(request.body);
    const invitation = await invitationService.create(input, request.auth!, metadata(request));
    response.status(201).json({ data: invitation });
  }),
);

router.patch(
  '/invitations/:id/revoke',
  authenticate,
  requirePermission(permissions.usersManage),
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const invitation = await prisma.userInvitation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            organizationId: true,
            roles: { select: { role: { select: { code: true } } } },
          },
        },
      },
    });
    if (!invitation) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'La invitación no existe.');
    }
    assertCanManageOrganization(request.auth!, invitation.user.organizationId);
    assertRolesAllowed(
      request.auth!,
      invitation.user.roles.map(({ role }) => role.code),
    );
    if (invitation.acceptedAt || invitation.revokedAt) {
      throw new AppError(409, 'INVITATION_NOT_PENDING', 'La invitación ya fue cerrada.');
    }
    const revokedAt = new Date();
    await prisma.userInvitation.update({ where: { id }, data: { revokedAt } });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: invitation.user.organizationId ?? undefined,
      action: 'REVOKE_INVITATION',
      module: 'USERS',
      entity: 'UserInvitation',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
    });
    response.json({ data: { id, revokedAt } });
  }),
);

router.patch(
  '/:id/status',
  authenticate,
  requirePermission(permissions.usersManage),
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = userStatusSchema.parse(request.body);
    if (id === request.auth!.id && input.status === 'SUSPENDED') {
      throw new AppError(409, 'SELF_SUSPENSION_FORBIDDEN', 'No puede suspender su propia cuenta.');
    }
    const previous = await getManagedUser(id, request.auth!);
    if (!['ACTIVE', 'SUSPENDED'].includes(previous.status)) {
      throw new AppError(
        409,
        'ACTIVATION_REQUIRED',
        'Las cuentas invitadas deben activarse desde su enlace seguro.',
      );
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { status: input.status, authVersion: { increment: 1 } },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await auditService.record({
      userId: request.auth!.id,
      organizationId: previous.organization?.id,
      action: 'STATUS_CHANGE',
      module: 'USERS',
      entity: 'User',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: { status: previous.status },
      newValues: { status: input.status },
    });
    response.json({ data: await getManagedUser(id, request.auth!) });
  }),
);

router.put(
  '/:id/roles',
  authenticate,
  requirePermission(permissions.usersManage),
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const input = userRolesSchema.parse(request.body);
    const previous = await getManagedUser(id, request.auth!);
    assertRolesAllowed(request.auth!, input.roleCodes);
    const uniqueCodes = [...new Set(input.roleCodes)];
    const roles = await prisma.role.findMany({
      where: { code: { in: uniqueCodes } },
      select: { id: true, code: true },
    });
    if (roles.length !== uniqueCodes.length) {
      throw new AppError(400, 'INVALID_ROLE', 'Uno o más roles no existen.');
    }
    const previousCodes = previous.roles.map(({ role }) => role.code);
    if (previousCodes.includes('SUPER_ADMIN') && !uniqueCodes.includes('SUPER_ADMIN')) {
      const superAdmins = await prisma.userRole.count({
        where: { role: { code: 'SUPER_ADMIN' }, user: { status: 'ACTIVE' } },
      });
      if (superAdmins <= 1) {
        throw new AppError(
          409,
          'LAST_SUPER_ADMIN_PROTECTED',
          'No puede retirar el rol al último superadministrador activo.',
        );
      }
    }
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: id } }),
      prisma.userRole.createMany({ data: roles.map((role) => ({ userId: id, roleId: role.id })) }),
      prisma.user.update({ where: { id }, data: { authVersion: { increment: 1 } } }),
      prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await auditService.record({
      userId: request.auth!.id,
      organizationId: previous.organization?.id,
      action: 'ASSIGN_ROLES',
      module: 'USERS',
      entity: 'User',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
      previousValues: { roleCodes: previousCodes },
      newValues: { roleCodes: uniqueCodes },
    });
    response.json({ data: await getManagedUser(id, request.auth!) });
  }),
);

router.patch(
  '/:id/unlock',
  authenticate,
  requirePermission(permissions.usersManage),
  asyncHandler(async (request, response) => {
    const id = parseId(request.params.id);
    const previous = await getManagedUser(id, request.auth!);
    await prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    await auditService.record({
      userId: request.auth!.id,
      organizationId: previous.organization?.id,
      action: 'UNLOCK',
      module: 'USERS',
      entity: 'User',
      entityId: id,
      result: 'SUCCESS',
      ...metadata(request),
    });
    response.json({ data: await getManagedUser(id, request.auth!) });
  }),
);

export { router as usersRouter };
