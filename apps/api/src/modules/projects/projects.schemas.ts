import { projectStatuses } from '@ecosoft/shared';
import { z } from 'zod';

const fields = {
  organizationId: z.uuid().optional(),
  name: z.string().trim().min(3).max(240),
  renewableTechnologyCode: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((value) => value.toUpperCase()),
  province: z.string().trim().min(2).max(120),
  municipality: z.string().trim().min(2).max(120),
  installedCapacityMw: z.coerce.number().positive().max(1_000_000),
  estimatedOperationDate: z.coerce.date().optional(),
};

export const projectCreateSchema = z.object(fields);
export const projectUpdateSchema = z.object(fields).partial();
export const projectStatusSchema = z.object({
  status: z.enum(projectStatuses),
  reason: z.string().trim().min(10).max(1000),
  actualOperationDate: z.coerce.date().optional(),
});
export const projectQuerySchema = z.object({
  organizationId: z.uuid().optional(),
  status: z.enum(projectStatuses).optional(),
  technology: z.string().trim().max(60).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
