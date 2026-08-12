import { z } from 'zod';

const normalizedEmail = z
  .email()
  .max(320)
  .transform((value) => value.trim().toLowerCase());
const roleCodes = z.array(z.string().trim().min(1).max(60)).min(1).max(10);

export const userQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['INVITED', 'PENDING_CONFIRMATION', 'ACTIVE', 'SUSPENDED']).optional(),
  organizationId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const invitationQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createInvitationSchema = z.object({
  email: normalizedEmail,
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  organizationId: z.uuid(),
  roleCodes,
});

export const invitationTokenSchema = z.object({
  token: z.string().trim().min(32).max(256),
});

const strongPassword = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres.')
  .max(128)
  .regex(/[a-z]/, 'Debe incluir una letra minúscula.')
  .regex(/[A-Z]/, 'Debe incluir una letra mayúscula.')
  .regex(/[0-9]/, 'Debe incluir un número.')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir un símbolo.');

export const acceptInvitationSchema = z
  .object({
    token: z.string().trim().min(32).max(256),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export const userStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export const userRolesSchema = z.object({ roleCodes });
