import { z } from 'zod';

const dateRangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.to >= value.from, {
    message: 'La fecha final debe ser igual o posterior a la inicial.',
    path: ['to'],
  });

export const analyticsQuerySchema = dateRangeSchema.and(
  z.object({
    organizationId: z.uuid().optional(),
    technology: z.string().trim().max(60).toUpperCase().optional(),
  }),
);

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
