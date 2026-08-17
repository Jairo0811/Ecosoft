import { z } from 'zod';

export const reportTypes = [
  'auctions',
  'participants',
  'bids',
  'awards',
  'contracts',
  'projects',
  'capacity',
  'audit',
] as const;

export const reportTypeSchema = z.enum(reportTypes);
export type ReportType = z.infer<typeof reportTypeSchema>;

export const reportQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    organizationId: z.uuid().optional(),
    technology: z.string().trim().max(60).toUpperCase().optional(),
    status: z.string().trim().max(40).toUpperCase().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((value) => !value.from || !value.to || value.to >= value.from, {
    message: 'La fecha final debe ser igual o posterior a la inicial.',
    path: ['to'],
  });

export const exportQuerySchema = reportQuerySchema.and(
  z.object({ format: z.enum(['csv', 'xls', 'pdf']).default('csv') }),
);

export type ReportQuery = z.infer<typeof reportQuerySchema>;
