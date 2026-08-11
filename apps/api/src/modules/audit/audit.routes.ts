import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission(permissions.auditRead),
  asyncHandler(async (_request, response) => {
    const events = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        module: true,
        entity: true,
        entityId: true,
        result: true,
        correlationId: true,
        createdAt: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    response.json({ data: events });
  }),
);

export { router as auditRouter };
