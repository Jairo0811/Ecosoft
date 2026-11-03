import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

const isClientError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status ?? 0;
  return status >= 400 && status < 500;
};

/**
 * Single application query cache.
 *
 * Every cached entry belongs to the identity that requested it. The cache is therefore
 * purged whenever the authenticated identity changes (login, logout, expiry or revocation)
 * so that data fetched for one user can never be rendered — not even momentarily — for
 * another user or organization. See `AuthContext.resetSessionCache`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx answers (permission, validation, not found) are deterministic: retrying only
      // delays the error state the user needs to see.
      retry: (failureCount, error) => !isClientError(error) && failureCount < 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const resetSessionCache = async (): Promise<void> => {
  await queryClient.cancelQueries();
  queryClient.clear();
};
