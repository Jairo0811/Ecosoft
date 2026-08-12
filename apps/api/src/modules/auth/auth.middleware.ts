import type { RequestHandler } from 'express';
import { AppError } from '../../common/app-error';
import { tokenService } from './token.service';

export const authenticate: RequestHandler = (request, _response, next) => {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Debe iniciar sesión.'));
    return;
  }
  request.auth = tokenService.verifyAccessToken(authorization.slice(7));
  next();
};

export const requirePermission =
  (...required: string[]): RequestHandler =>
  (request, _response, next) => {
    if (!request.auth) {
      next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Debe iniciar sesión.'));
      return;
    }
    const allowed = required.every((permission) => request.auth?.permissions.includes(permission));
    if (!allowed) {
      next(new AppError(403, 'INSUFFICIENT_PERMISSION', 'No posee permisos para esta acción.'));
      return;
    }
    next();
  };

export const requireTrustedWebRequest: RequestHandler = (request, _response, next) => {
  if (request.header('x-requested-with') !== 'EcoSoftWeb') {
    next(new AppError(403, 'UNTRUSTED_REQUEST', 'Solicitud web no confiable.'));
    return;
  }
  next();
};
