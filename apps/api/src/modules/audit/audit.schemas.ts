import { z } from 'zod';

export const auditQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    action: z.string().trim().max(40).optional(),
    module: z.string().trim().max(60).optional(),
    result: z.enum(['SUCCESS', 'FAILURE', 'DENIED']).optional(),
    userId: z.uuid().optional(),
    organizationId: z.uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'La fecha inicial no puede ser posterior a la final.',
    path: ['to'],
  });
