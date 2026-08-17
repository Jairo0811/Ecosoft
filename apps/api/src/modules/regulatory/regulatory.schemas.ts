import { regulationScopeTypes, regulationStatuses, regulationTypes } from '@ecosoft/shared';
import { z } from 'zod';

const scopeSchema = z.object({
  entityType: z.enum(regulationScopeTypes),
  entityId: z.uuid(),
  notes: z.string().trim().max(1000).optional(),
});

const fields = {
  code: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[A-Za-z0-9._/-]+$/, 'El código contiene caracteres no permitidos.')
    .transform((value) => value.toUpperCase()),
  title: z.string().trim().min(5).max(300),
  summary: z.string().trim().max(2000).optional(),
  type: z.enum(regulationTypes),
  issuingOrganizationId: z.uuid(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
  sourceUrl: z.url().max(1000).optional(),
  documentReference: z.string().trim().max(500).optional(),
  scopes: z.array(scopeSchema).max(50).default([]),
};

export const regulationCreateSchema = z
  .object(fields)
  .refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, {
    message: 'La fecha final no puede ser anterior a la fecha de vigencia.',
    path: ['effectiveTo'],
  });

export const regulationUpdateSchema = z
  .object({
    ...fields,
    scopes: z.array(scopeSchema).max(50).optional(),
  })
  .partial()
  .refine(
    (value) =>
      !value.effectiveFrom || !value.effectiveTo || value.effectiveTo >= value.effectiveFrom,
    {
      message: 'La fecha final no puede ser anterior a la fecha de vigencia.',
      path: ['effectiveTo'],
    },
  );

export const regulationStatusSchema = z.object({
  status: z.enum(regulationStatuses),
  reason: z.string().trim().min(10).max(1000),
});

export const regulationQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(regulationTypes).optional(),
  status: z.enum(regulationStatuses).optional(),
  authorityId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
