import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler';
import { env } from '../../config/env';
import { authenticate, requireTrustedWebRequest } from './auth.middleware';
import { authService } from './auth.service';
import { invitationService } from '../users/invitations.service';
import { acceptInvitationSchema, invitationTokenSchema } from '../users/users.schemas';

const router = Router();
const credentialsSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(8).max(128),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.header('user-agent'),
  correlationId: request.correlationId,
});

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (request, response) => {
    const input = credentialsSchema.parse(request.body);
    const result = await authService.login(input.email, input.password, metadata(request));
    response.cookie('ecosoft_refresh', result.refreshToken, cookieOptions);
    response.json({ accessToken: result.accessToken, user: result.user });
  }),
);

router.post(
  '/invitations/validate',
  authLimiter,
  asyncHandler(async (request, response) => {
    const { token } = invitationTokenSchema.parse(request.body);
    response.json({ data: await invitationService.validate(token) });
  }),
);

router.post(
  '/invitations/accept',
  authLimiter,
  asyncHandler(async (request, response) => {
    const input = acceptInvitationSchema.parse(request.body);
    await invitationService.accept(input.token, input.password, metadata(request));
    response.status(204).send();
  }),
);

router.post(
  '/refresh',
  authLimiter,
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const rawToken = request.cookies.ecosoft_refresh as string | undefined;
    if (!rawToken) {
      response.status(401).json({
        code: 'REFRESH_TOKEN_REQUIRED',
        message: 'No existe una sesión renovable.',
        correlationId: request.correlationId,
      });
      return;
    }
    const result = await authService.refresh(rawToken, metadata(request));
    response.cookie('ecosoft_refresh', result.refreshToken, cookieOptions);
    response.json({ accessToken: result.accessToken, user: result.user });
  }),
);

router.post(
  '/logout',
  authenticate,
  requireTrustedWebRequest,
  asyncHandler(async (request, response) => {
    const rawToken = request.cookies.ecosoft_refresh as string | undefined;
    await authService.logout(rawToken, request.auth!, metadata(request));
    response.clearCookie('ecosoft_refresh', cookieOptions);
    response.status(204).send();
  }),
);

router.get('/me', authenticate, (request, response) => response.json({ user: request.auth }));

export { router as authRouter };
