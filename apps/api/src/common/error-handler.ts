import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { AppError } from './app-error';

export const notFound: RequestHandler = (request, _response, next) => {
  next(new AppError(404, 'NOT_FOUND', `Ruta no encontrada: ${request.method} ${request.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;
  if (error instanceof ZodError) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'La solicitud contiene datos inválidos.',
      correlationId: request.correlationId,
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const appError = error instanceof AppError ? error : null;
  const status = appError?.statusCode ?? 500;
  if (status >= 500) {
    logger.error({ err: error, correlationId: request.correlationId }, 'Unhandled request error');
  }

  response.status(status).json({
    code: appError?.code ?? 'INTERNAL_ERROR',
    message: appError?.message ?? 'Ocurrió un error interno.',
    correlationId: request.correlationId,
    ...(appError?.details === undefined ? {} : { details: appError.details }),
  });
};
