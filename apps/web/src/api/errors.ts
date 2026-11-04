import axios from 'axios';

interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
  correlationId?: string;
}

/**
 * Turns an API failure into a message that says what happened and what to do. Server messages
 * are already user-facing Spanish; this adds network context, the list of missing requirements
 * when the API provides it, and the correlation id users can quote to support on 5xx errors.
 */
export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return 'No hay comunicación con el servidor. Verifique su conexión e intente nuevamente.';
    }
    const body = error.response.data;
    const status = error.response.status;
    if (status === 413) return 'El archivo o la solicitud excede el tamaño máximo permitido.';
    let message = body?.message ?? 'No fue posible completar la operación.';
    if (Array.isArray(body?.details) && body.details.every((item) => typeof item === 'string')) {
      message = `${message} (${body.details.join(', ')})`;
    }
    if (status >= 500 && body?.correlationId) {
      message = `${message} Referencia: ${body.correlationId}.`;
    }
    return message;
  }
  return error instanceof Error ? error.message : 'No fue posible completar la operación.';
};
