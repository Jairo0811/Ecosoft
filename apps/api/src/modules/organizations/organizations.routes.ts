import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission(permissions.organizationsRead),
  asyncHandler(async (_request, response) => {
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        rnc: true,
        legalName: true,
        commercialName: true,
        type: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { legalName: 'asc' },
      take: 100,
    });
    response.json({ data: organizations });
  }),
);

export { router as organizationsRouter };
