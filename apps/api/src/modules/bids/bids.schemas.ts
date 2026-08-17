import { bidStatuses } from '@ecosoft/shared';
import { z } from 'zod';

const fields = {
  auctionId: z.uuid(),
  projectName: z.string().trim().min(3).max(240),
  renewableTechnologyCode: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((value) => value.toUpperCase()),
  projectLocation: z.string().trim().max(300).optional(),
  offeredPowerMw: z.coerce.number().positive().max(1_000_000),
  estimatedEnergyMwh: z.coerce.number().positive().max(1_000_000_000),
  offeredPrice: z.coerce.number().positive().max(1_000_000),
  currencyCode: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((value) => value.toUpperCase()),
  validUntil: z.coerce.date(),
};

export const bidCreateSchema = z.object(fields);
export const bidUpdateSchema = z
  .object({
    ...fields,
    auctionId: z.never().optional(),
    changeReason: z.string().trim().min(10).max(1000),
  })
  .partial()
  .required({ changeReason: true });

export const bidActionSchema = z.object({ reason: z.string().trim().min(10).max(1000) });

export const bidQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  auctionId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  status: z.enum(bidStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
