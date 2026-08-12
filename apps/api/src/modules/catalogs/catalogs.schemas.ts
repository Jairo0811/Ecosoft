import { catalogTypes } from '@ecosoft/shared';
import { z } from 'zod';

export const catalogQuerySchema = z.object({
  type: z.enum(catalogTypes).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  q: z.string().trim().max(160).optional(),
});

export const catalogCreateSchema = z.object({
  type: z.enum(catalogTypes),
  code: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[A-Z0-9_]+$/),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const catalogUpdateSchema = catalogCreateSchema.omit({ type: true }).partial();

export const serializeMetadata = (metadata: Record<string, unknown> | undefined) =>
  metadata ? JSON.stringify(metadata) : undefined;

export const parseMetadata = (metadataJson: string | null) => {
  if (!metadataJson) return null;
  return JSON.parse(metadataJson) as Record<string, unknown>;
};
