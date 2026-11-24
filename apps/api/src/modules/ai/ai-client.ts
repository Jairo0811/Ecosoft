import { AppError } from '../../common/app-error';
import { env } from '../../config/env';
import type { z } from 'zod';
import {
  aiServiceCapabilitiesSchema,
  aiServiceResultSchema,
  type AIServiceCapabilities,
  type AIServiceResult,
} from './ai.schemas';

const request = async <T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> => {
  try {
    const response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(env.AI_SERVICE_TIMEOUT_MS),
    });
    if (response.status === 422) {
      throw new AppError(
        422,
        'AI_INPUT_REJECTED',
        'El servicio de IA rechazó el contenido: formato o tamaño no admitido por el proveedor.',
      );
    }
    if (!response.ok) {
      throw new AppError(
        502,
        'AI_SERVICE_ERROR',
        'El servicio de IA no pudo procesar la solicitud.',
      );
    }
    return schema.parse(await response.json());
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'El servicio de IA no está disponible.');
  }
};

export const aiClient = {
  analyze(text: string, operation: 'SUMMARY' | 'ANOMALY_REVIEW'): Promise<AIServiceResult> {
    return request('/v1/analyze', aiServiceResultSchema, { text, operation });
  },
  ocr(contentBase64: string, mimeType: string): Promise<AIServiceResult> {
    return request('/v1/ocr', aiServiceResultSchema, {
      content_base64: contentBase64,
      mime_type: mimeType,
    });
  },
  capabilities(): Promise<AIServiceCapabilities> {
    return request('/v1/capabilities', aiServiceCapabilitiesSchema);
  },
};
