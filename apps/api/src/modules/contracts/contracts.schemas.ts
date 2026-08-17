import { contractStatuses } from '@ecosoft/shared';
import { z } from 'zod';

const fields = {
  contractNumber: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .transform((value) => value.toUpperCase()),
  awardId: z.uuid(),
  projectId: z.uuid(),
  signatureDate: z.coerce.date().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  price: z.coerce.number().positive().max(1_000_000),
  currencyCode: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((value) => value.toUpperCase()),
  capacityMw: z.coerce.number().positive().max(1_000_000),
  committedEnergyMwh: z.coerce.number().positive().max(1_000_000_000),
  conditions: z.string().trim().max(20_000).optional(),
};

export const contractCreateSchema = z
  .object(fields)
  .refine((value) => value.endDate > value.startDate, {
    path: ['endDate'],
    message: 'La fecha final debe ser posterior al inicio.',
  });
export const contractUpdateSchema = z
  .object({
    ...fields,
    awardId: z.never().optional(),
    projectId: z.never().optional(),
    changeReason: z.string().trim().min(10).max(1000),
  })
  .partial()
  .required({ changeReason: true });
export const contractStatusSchema = z.object({
  status: z.enum(contractStatuses),
  reason: z.string().trim().min(10).max(1000),
  signatureDate: z.coerce.date().optional(),
});
export const contractQuerySchema = z.object({
  organizationId: z.uuid().optional(),
  status: z.enum(contractStatuses).optional(),
  q: z.string().trim().max(100).optional(),
  expiringBefore: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
