import { notificationSeverities } from '@ecosoft/shared';
import { z } from 'zod';

export const notificationQuerySchema = z.object({
  unread: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  type: z.string().trim().max(50).optional(),
  severity: z.enum(notificationSeverities).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
