import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { SessionUser } from '@ecosoft/shared';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';
const tokenKey = 'ecosoft_access_token';
const asError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error('Error inesperado en la comunicación con la API.');

export const SESSION_EXPIRED_EVENT = 'ecosoft:session-expired';
export const trustedWebHeaders = { 'X-Requested-With': 'EcoSoftWeb' } as const;

export const authStorage = {
  getToken: () => sessionStorage.getItem(tokenKey),
  setToken: (token: string) => sessionStorage.setItem(tokenKey, token),
  clear: () => sessionStorage.removeItem(tokenKey),
};

export const apiClient = axios.create({ baseURL: apiUrl, withCredentials: true });

type RetriableConfig = InternalAxiosRequestConfig & {
  _retried?: boolean;
  /** Access token attached when the request was first sent (identity snapshot). */
  _sentWithToken?: string | null;
};

apiClient.interceptors.request.use((config: RetriableConfig) => {
  const token = authStorage.getToken();
  if (!config._retried) config._sentWithToken = token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Endpoints whose 401 must never trigger a silent refresh: credentials are wrong, the
 * refresh itself failed or the user is leaving. `/auth/me` is intentionally NOT listed so
 * that restoring a tab with an expired access token recovers through the refresh cookie.
 */
const nonRefreshable = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/invitations/'];

let refreshInProgress: Promise<{ accessToken: string; user: SessionUser }> | null = null;

const isRefreshConflict = (error: unknown) =>
  axios.isAxiosError<{ code?: string }>(error) && error.response?.data?.code === 'REFRESH_CONFLICT';

const postRefresh = () =>
  apiClient.post<{ accessToken: string; user: SessionUser }>(
    '/auth/refresh',
    {},
    { headers: trustedWebHeaders },
  );

/**
 * Rotates the refresh cookie once; concurrent callers in this tab share the same request.
 * If another tab rotated the shared cookie at the same instant the server answers
 * REFRESH_CONFLICT: the browser already holds the winner's cookie, so one retry recovers.
 */
export const refreshSession = (): Promise<{ accessToken: string; user: SessionUser }> => {
  refreshInProgress ??= postRefresh()
    .catch(async (error: unknown) => {
      if (!isRefreshConflict(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
      return postRefresh();
    })
    .then(({ data }) => {
      authStorage.setToken(data.accessToken);
      return data;
    })
    .finally(() => {
      refreshInProgress = null;
    });
  return refreshInProgress;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) {
      return Promise.reject(asError(error));
    }
    const original = error.config as RetriableConfig;
    if (original._retried || nonRefreshable.some((path) => original.url?.includes(path))) {
      return Promise.reject(error);
    }
    original._retried = true;

    let accessToken: string;
    try {
      ({ accessToken } = await refreshSession());
    } catch (refreshError) {
      // Only terminate the session that issued this request. A late 401 belonging to a
      // previous identity must not log out a user who has signed in since then.
      const current = authStorage.getToken();
      const sameIdentity = !current || current === original._sentWithToken;
      if (sameIdentity) {
        authStorage.clear();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      return Promise.reject(asError(refreshError));
    }
    // Errors of the replayed request (403, 500…) are reported as-is and never end the session.
    original.headers.Authorization = `Bearer ${accessToken}`;
    return apiClient.request(original);
  },
);
