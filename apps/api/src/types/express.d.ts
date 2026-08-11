import type { SessionUser } from '@ecosoft/shared';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      auth?: SessionUser;
    }
  }
}

export {};
