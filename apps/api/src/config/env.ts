import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  INVITATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(48),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DOCUMENT_STORAGE_PATH: z.string().min(1).default('.data/documents'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(10_000),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const names = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Configuración inválida o ausente: ${names}`);
}

export const env = result.data;
