import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { SessionUser } from '@ecosoft/shared';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';
const tokenKey = 'ecosoft_access_token';
const asError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error('Error inesperado en la comunicación con la API.');

export const authStorage = {
  getToken: () => sessionStorage.getItem(tokenKey),
  setToken: (token: string) => sessionStorage.setItem(tokenKey, token),
  clear: () => sessionStorage.removeItem(tokenKey),
};

export const apiClient = axios.create({ baseURL: apiUrl, withCredentials: true });

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authStorage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshInProgress: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) {
      return Promise.reject(asError(error));
    }
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (original._retried || original.url?.includes('/auth/')) return Promise.reject(error);
    original._retried = true;

    refreshInProgress ??= apiClient
      .post<{ accessToken: string; user: SessionUser }>(
        '/auth/refresh',
        {},
        { headers: { 'X-Requested-With': 'EcoSoftWeb' } },
      )
      .then(({ data }) => {
        authStorage.setToken(data.accessToken);
        return data.accessToken;
      })
      .finally(() => {
        refreshInProgress = null;
      });

    try {
      original.headers.Authorization = `Bearer ${await refreshInProgress}`;
      return await apiClient.request(original);
    } catch (refreshError) {
      authStorage.clear();
      window.dispatchEvent(new Event('ecosoft:session-expired'));
      return Promise.reject(asError(refreshError));
    }
  },
);
