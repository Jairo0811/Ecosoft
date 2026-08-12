import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission(permissions.usersManage),
  asyncHandler(async (_request, response) => {
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: { select: { permission: { select: { code: true, description: true } } } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
    response.json({ data: roles });
  }),
);

export { router as rolesRouter };
