/** Prisma "Unique constraint failed" (P2002), detected structurally to stay mock-friendly. */
export const isUniqueConstraintViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
