import { auctionStatuses, calendarEventTypes } from '@ecosoft/shared';
import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const dateFields = z
  .object({
    openAt: z.coerce.date(),
    closeAt: z.coerce.date(),
    evaluationStartAt: z.coerce.date().optional(),
    awardPlannedAt: z.coerce.date().optional(),
  })
  .refine(({ openAt, closeAt }) => closeAt > openAt, {
    message: 'El cierre debe ser posterior a la apertura.',
    path: ['closeAt'],
  })
  .refine(({ closeAt, evaluationStartAt }) => !evaluationStartAt || evaluationStartAt >= closeAt, {
    message: 'La evaluación no puede comenzar antes del cierre.',
    path: ['evaluationStartAt'],
  })
  .refine(
    ({ evaluationStartAt, awardPlannedAt }) =>
      !awardPlannedAt || !evaluationStartAt || awardPlannedAt >= evaluationStartAt,
    { message: 'La adjudicación debe ser posterior a la evaluación.', path: ['awardPlannedAt'] },
  );

const auctionFields = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,40}$/),
  title: z.string().trim().min(5).max(240),
  description: optionalText(10_000),
  managingOrganizationId: z.uuid(),
  renewableTechnologyCode: z.string().trim().toUpperCase().min(2).max(60),
  currencyCode: z.string().trim().toUpperCase().min(2).max(10),
  capacityMw: z.coerce.number().positive().max(1_000_000),
  maximumPrice: z.coerce.number().positive().max(1_000_000_000).optional(),
  timezone: z.string().trim().min(3).max(80).default('America/Santo_Domingo'),
});

export const auctionCreateSchema = auctionFields.and(dateFields);
export const auctionUpdateSchema = auctionFields.partial().and(
  z.object({
    openAt: z.coerce.date().optional(),
    closeAt: z.coerce.date().optional(),
    evaluationStartAt: z.coerce.date().nullable().optional(),
    awardPlannedAt: z.coerce.date().nullable().optional(),
  }),
);

export const auctionQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(auctionStatuses).optional(),
  technology: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const requirementListSchema = z.object({
  requirements: z
    .array(
      z.object({
        code: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9_-]{2,60}$/),
        title: z.string().trim().min(3).max(200),
        description: optionalText(1000),
        category: z.enum(['LEGAL', 'TECNICO', 'FINANCIERO', 'REGULATORIO', 'OTRO']),
        isMandatory: z.boolean().default(true),
        sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
      }),
    )
    .min(1)
    .max(100),
});

export const participantListSchema = z.object({
  participants: z
    .array(
      z.object({
        organizationId: z.uuid(),
        status: z.enum(['HABILITADO', 'SUSPENDIDO', 'RETIRADO']).default('HABILITADO'),
        notes: optionalText(1000),
      }),
    )
    .max(500),
});

export const auctionStatusSchema = z.object({
  status: z.enum(auctionStatuses),
  reason: z.string().trim().min(10).max(1000).optional(),
});

export const calendarQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    type: z.enum(calendarEventTypes).optional(),
  })
  .refine(({ from, to }) => to >= from, { message: 'El rango de fechas no es válido.' })
  .refine(({ from, to }) => to.getTime() - from.getTime() <= 366 * 24 * 60 * 60 * 1000, {
    message: 'El rango no puede superar 366 días.',
  });

export const calendarEventCreateSchema = z
  .object({
    auctionId: z.uuid().optional(),
    type: z.enum(calendarEventTypes),
    title: z.string().trim().min(3).max(240),
    description: optionalText(1000),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    allDay: z.boolean().default(false),
    location: optionalText(300),
  })
  .refine(({ startsAt, endsAt }) => !endsAt || endsAt >= startsAt, {
    message: 'El fin no puede ser anterior al inicio.',
    path: ['endsAt'],
  });
