import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { SESSION_EXPIRED_EVENT, apiClient, authStorage } from '../api/client';
import { queryClient } from '../api/queryClient';
import { AuthProvider, useAuth } from './AuthContext';

const identities = {
  'a@ecosoft.test': { id: 'user-a', organization: 'Org A', token: 'token-a' },
  'b@ecosoft.test': { id: 'user-b', organization: 'Org B', token: 'token-b' },
} as const;

const sessionUser = (email: keyof typeof identities) => ({
  id: identities[email].id,
  email,
  firstName: identities[email].id,
  lastName: 'Test',
  organizationId: identities[email].organization,
  authVersion: 1,
  roles: ['COMPANY_ADMIN'],
  permissions: ['analytics.read'],
});

let resolveDashboard: Array<() => void> = [];

const installServer = () => {
  apiClient.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    const ok = (data: unknown): Promise<AxiosResponse> =>
      Promise.resolve({ status: 200, statusText: 'OK', headers: {}, config, data });
    if (config.url === '/auth/refresh') {
      const response = { status: 401, statusText: '401', headers: {}, config, data: {} };
      return Promise.reject(new AxiosError('401', '401', config, undefined, response));
    }
    if (config.url === '/auth/login') {
      const { email } = JSON.parse(config.data as string) as { email: keyof typeof identities };
      return ok({ accessToken: identities[email].token, user: sessionUser(email) });
    }
    if (config.url === '/auth/logout') return ok({});
    if (config.url === '/dashboard') {
      const authorization = String(config.headers.Authorization);
      const owner = authorization.endsWith('token-a') ? 'Org A' : 'Org B';
      // Responses are held until the test releases them to simulate slow requests.
      return new Promise((resolve) => {
        resolveDashboard.push(() =>
          resolve({ status: 200, statusText: 'OK', headers: {}, config, data: { owner } }),
        );
      });
    }
    return ok({});
  };
};

function Dashboard() {
  const { data, isPending } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<{ owner: string }>('/dashboard').then((r) => r.data),
  });
  return <p>{isPending ? 'cargando' : `datos de ${data?.owner}`}</p>;
}

function Harness() {
  const { user, login, logout } = useAuth();
  return (
    <>
      <p>usuario: {user?.email ?? 'ninguno'}</p>
      {user && <Dashboard />}
      <button onClick={() => void login('a@ecosoft.test', 'secret-password')}>login A</button>
      <button onClick={() => void login('b@ecosoft.test', 'secret-password')}>login B</button>
      <button onClick={() => void logout()}>logout</button>
    </>
  );
}

const renderHarness = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Harness />
      </AuthProvider>
    </QueryClientProvider>,
  );

const releaseAll = async () => {
  await act(async () => {
    const pending = resolveDashboard;
    resolveDashboard = [];
    pending.forEach((release) => release());
    await Promise.resolve();
  });
};

describe('AuthProvider session isolation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    queryClient.clear();
    resolveDashboard = [];
    installServer();
  });

  it('skips the silent refresh on a cold visit and tries it when a session hint exists', async () => {
    const calls: string[] = [];
    const adapter = apiClient.defaults.adapter as (config: InternalAxiosRequestConfig) => unknown;
    apiClient.defaults.adapter = (config: InternalAxiosRequestConfig) => {
      calls.push(String(config.url));
      return adapter(config) as Promise<AxiosResponse>;
    };
    authStorage.setSessionHint(false);
    const cold = renderHarness();
    await screen.findByText('usuario: ninguno');
    expect(calls).not.toContain('/auth/refresh');
    cold.unmount();

    authStorage.setSessionHint(true);
    renderHarness();
    await waitFor(() => expect(calls).toContain('/auth/refresh'));
    // The failed refresh clears the stale hint so the next cold visit stays quiet.
    await waitFor(() => expect(authStorage.hasSessionHint()).toBe(false));
  });

  it('never shows data of user A to user B after logout, not even from cache', async () => {
    renderHarness();
    await screen.findByText('usuario: ninguno');

    act(() => screen.getByText('login A').click());
    await screen.findByText('usuario: a@ecosoft.test');
    await releaseAll();
    await screen.findByText('datos de Org A');

    act(() => screen.getByText('logout').click());
    await screen.findByText('usuario: ninguno');
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(authStorage.getToken()).toBeNull();

    act(() => screen.getByText('login B').click());
    await screen.findByText('usuario: b@ecosoft.test');
    // B must start from an empty cache: a loading state, never "Org A".
    expect(screen.getByText('cargando')).toBeInTheDocument();
    expect(screen.queryByText('datos de Org A')).not.toBeInTheDocument();
    await releaseAll();
    await screen.findByText('datos de Org B');
  });

  it('discards a slow response of user A that arrives after the session ended', async () => {
    renderHarness();
    await screen.findByText('usuario: ninguno');
    act(() => screen.getByText('login A').click());
    await screen.findByText('cargando');

    act(() => screen.getByText('logout').click());
    await screen.findByText('usuario: ninguno');
    await releaseAll(); // A's response lands now
    expect(queryClient.getQueryData(['dashboard'])).toBeUndefined();

    act(() => screen.getByText('login B').click());
    await screen.findByText('cargando');
    expect(screen.queryByText('datos de Org A')).not.toBeInTheDocument();
  });

  it('purges the cache when the session expires or is revoked', async () => {
    renderHarness();
    await screen.findByText('usuario: ninguno');
    act(() => screen.getByText('login A').click());
    await screen.findByText('cargando');
    await releaseAll();
    await screen.findByText('datos de Org A');

    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });
    await screen.findByText('usuario: ninguno');
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });
});
