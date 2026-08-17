import { evaluationTypes } from '@ecosoft/shared';
import { z } from 'zod';

const criterionSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .transform((value) => value.toUpperCase()),
    title: z.string().trim().min(3).max(240),
    description: z.string().trim().max(1000).optional(),
    type: z.enum(evaluationTypes),
    weight: z.coerce.number().positive().max(1),
    minimumScore: z.coerce.number().min(0).optional(),
    maximumScore: z.coerce.number().positive().max(1000),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .refine((value) => value.minimumScore === undefined || value.minimumScore <= value.maximumScore, {
    path: ['minimumScore'],
    message: 'El mínimo no puede superar el máximo.',
  });

export const matrixCreateSchema = z
  .object({
    auctionId: z.uuid(),
    name: z.string().trim().min(5).max(240),
    criteria: z.array(criterionSchema).min(2).max(50),
  })
  .refine(
    (value) => Math.abs(value.criteria.reduce((sum, item) => sum + item.weight, 0) - 1) < 0.0001,
    { path: ['criteria'], message: 'La suma de ponderaciones debe ser 1.' },
  );

export const evaluationSubmitSchema = z.object({
  matrixId: z.uuid(),
  bidId: z.uuid(),
  type: z.enum(evaluationTypes),
  comments: z.string().trim().max(2000).optional(),
  scores: z
    .array(
      z.object({
        criterionId: z.uuid(),
        score: z.coerce.number().min(0).max(1000),
        comments: z.string().trim().max(1000).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const evaluationQuerySchema = z.object({
  auctionId: z.uuid().optional(),
  bidId: z.uuid().optional(),
  type: z.enum(evaluationTypes).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const awardCreateSchema = z.object({
  bidId: z.uuid(),
  resolutionNumber: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .transform((value) => value.toUpperCase()),
  awardedPrice: z.coerce.number().positive().max(1_000_000),
  awardedCapacityMw: z.coerce.number().positive().max(1_000_000),
  justification: z.string().trim().min(20).max(2000),
});

export const awardDecisionSchema = z.object({ reason: z.string().trim().min(10).max(1000) });
