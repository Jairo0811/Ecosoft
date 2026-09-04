import { createServer } from 'node:http';
import { createApp } from './app';
import { enterpriseConfig } from './config/enterprise';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';

const server = createServer(createApp());

server.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
      edition: enterpriseConfig.edition,
      installationId: enterpriseConfig.installationId,
      tenancyMode: enterpriseConfig.tenancyMode,
      telemetryEnabled: enterpriseConfig.integrations.telemetryEnabled,
    },
    'EcoSoft API listening',
  );
});

const shutdown = (signal: string): void => {
  logger.info({ signal }, 'Graceful shutdown started');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
