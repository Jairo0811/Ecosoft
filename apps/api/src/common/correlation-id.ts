import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const correlationId: RequestHandler = (request, response, next) => {
  const provided = request.header('x-correlation-id');
  request.correlationId = provided && uuidPattern.test(provided) ? provided : randomUUID();
  response.setHeader('x-correlation-id', request.correlationId);
  next();
};
