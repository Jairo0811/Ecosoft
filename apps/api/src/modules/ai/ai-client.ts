import { AppError } from '../../common/app-error';
import { env } from '../../config/env';
import { aiServiceResultSchema, type AIServiceResult } from './ai.schemas';

const call = async (path: string, body: unknown): Promise<AIServiceResult> => {
  try {
    const response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.AI_SERVICE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new AppError(
        502,
        'AI_SERVICE_ERROR',
        'El servicio de IA no pudo procesar la solicitud.',
      );
    }
    return aiServiceResultSchema.parse(await response.json());
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'El servicio de IA no está disponible.');
  }
};

export const aiClient = {
  analyze(text: string, operation: 'SUMMARY' | 'ANOMALY_REVIEW'): Promise<AIServiceResult> {
    return call('/v1/analyze', { text, operation });
  },
  ocr(contentBase64: string, mimeType: string): Promise<AIServiceResult> {
    return call('/v1/ocr', { content_base64: contentBase64, mime_type: mimeType });
  },
};
