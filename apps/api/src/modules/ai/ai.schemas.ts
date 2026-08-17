import { z } from 'zod';

export const aiAnalysisCreateSchema = z.object({
  documentId: z.uuid(),
  operation: z.enum(['SUMMARY', 'ANOMALY_REVIEW']),
});

export const aiOcrCreateSchema = z.object({ documentId: z.uuid() });

export const aiReviewSchema = z.object({
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  notes: z.string().trim().min(5).max(1000),
});

export const aiQuerySchema = z.object({
  documentId: z.uuid().optional(),
  operation: z.enum(['OCR', 'SUMMARY', 'ANOMALY_REVIEW']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const aiServiceResultSchema = z.object({
  provider: z.string().min(1).max(60),
  result: z.record(z.string(), z.unknown()),
  source_references: z.array(z.string().max(500)).max(100),
  confidence: z.number().min(0).max(1),
});

export type AIServiceResult = z.infer<typeof aiServiceResultSchema>;
