import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { permissions } from '../auth/permissions';
import { analyticsQuerySchema } from './analytics.schemas';
import { getDashboardAnalytics } from './analytics.service';

const router = Router();

router.get(
  '/dashboard',
  authenticate,
  requirePermission(permissions.analyticsRead),
  asyncHandler(async (request, response) => {
    const query = analyticsQuerySchema.parse(request.query);
    response.json({ data: await getDashboardAnalytics(request.auth!, query) });
  }),
);

export { router as analyticsRouter };
