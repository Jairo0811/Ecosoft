import { documentEntityTypes } from '@ecosoft/shared';
import { z } from 'zod';

const fileFields = {
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]),
  contentBase64: z.string().min(1).max(7_100_000),
};

export const documentCreateSchema = z.object({
  entityType: z.enum(documentEntityTypes),
  entityId: z.uuid(),
  documentType: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((value) => value.toUpperCase()),
  title: z.string().trim().min(3).max(240),
  confidentiality: z.enum(['PRIVATE', 'INSTITUTIONAL']).default('PRIVATE'),
  ...fileFields,
});

export const documentVersionSchema = z.object(fileFields);

export const documentQuerySchema = z.object({
  entityType: z.enum(documentEntityTypes).optional(),
  entityId: z.uuid().optional(),
  documentType: z.string().trim().max(60).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
