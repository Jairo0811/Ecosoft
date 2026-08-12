import axios from 'axios';
import type { ApiErrorResponse } from '@ecosoft/shared';

export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? 'No fue posible completar la operación.';
  }
  return error instanceof Error ? error.message : 'No fue posible completar la operación.';
};
