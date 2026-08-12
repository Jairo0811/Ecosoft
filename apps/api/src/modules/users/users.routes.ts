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
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        lastLoginAt: true,
        organization: { select: { id: true, commercialName: true, legalName: true } },
        roles: { select: { role: { select: { code: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    response.json({ data: users });
  }),
);

export { router as usersRouter };
