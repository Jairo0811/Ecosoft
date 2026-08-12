import { organizationStatuses, organizationTypes } from '@ecosoft/shared';
import { z } from 'zod';

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

export const organizationQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(organizationStatuses).optional(),
  type: z.enum(organizationTypes).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const organizationCreateSchema = z.object({
  rnc: z
    .string()
    .trim()
    .regex(/^\d{9}$/, 'El RNC debe contener 9 dígitos.')
    .optional(),
  legalName: z.string().trim().min(2).max(200),
  commercialName: optionalText(200),
  type: z.enum(organizationTypes),
  contactName: optionalText(200),
  contactEmail: z.email().max(320).optional(),
  contactPhone: optionalText(30),
  website: z.url().max(500).optional(),
});

export const organizationUpdateSchema = organizationCreateSchema.partial();

export const organizationStatusSchema = z
  .object({
    status: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']),
    reason: optionalText(1000),
  })
  .superRefine((value, context) => {
    if (['REJECTED', 'SUSPENDED'].includes(value.status) && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Debe indicar el motivo de esta decisión.',
      });
    }
  });
