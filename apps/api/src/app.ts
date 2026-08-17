import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { correlationId } from './common/correlation-id';
import { errorHandler, notFound } from './common/error-handler';
import { env } from './config/env';
import { logger } from './config/logger';
import { auditRouter } from './modules/audit/audit.routes';
import { catalogsRouter } from './modules/catalogs/catalogs.routes';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { organizationsRouter } from './modules/organizations/organizations.routes';
import { rolesRouter } from './modules/roles/roles.routes';
import { usersRouter } from './modules/users/users.routes';
import { auctionsRouter } from './modules/auctions/auctions.routes';
import { calendarRouter } from './modules/calendar/calendar.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { regulatoryRouter } from './modules/regulatory/regulatory.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { bidsRouter } from './modules/bids/bids.routes';
import { documentsRouter } from './modules/documents/documents.routes';
import { evaluationsRouter } from './modules/evaluations/evaluations.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { contractsRouter } from './modules/contracts/contracts.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { openApiDocument } from './openapi';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(correlationId);
  app.use(
    pinoHttp({ logger, customProps: (request) => ({ correlationId: request.correlationId }) }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '8mb' }));
  app.use(cookieParser());

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/organizations', organizationsRouter);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/audit', auditRouter);
  app.use('/api/v1/catalogs', catalogsRouter);
  app.use('/api/v1/auctions', auctionsRouter);
  app.use('/api/v1/calendar', calendarRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/regulatory', regulatoryRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/bids', bidsRouter);
  app.use('/api/v1/documents', documentsRouter);
  app.use('/api/v1/evaluations', evaluationsRouter);
  app.use('/api/v1/projects', projectsRouter);
  app.use('/api/v1/contracts', contractsRouter);
  app.use('/api/v1/ai', aiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
