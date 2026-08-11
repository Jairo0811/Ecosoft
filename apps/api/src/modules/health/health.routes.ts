import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { prisma } from '../../config/prisma';

const router = Router();

router.get('/live', (_request, response) => {
  response.json({ status: 'ok', service: 'ecosoft-api', timestamp: new Date().toISOString() });
});

router.get(
  '/ready',
  asyncHandler(async (_request, response) => {
    await prisma.$queryRaw`SELECT 1 AS ready`;
    response.json({
      status: 'ready',
      dependencies: { database: 'up' },
      timestamp: new Date().toISOString(),
    });
  }),
);

export { router as healthRouter };
