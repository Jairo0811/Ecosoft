import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { SESSION_EXPIRED_EVENT, apiClient, authStorage } from './client';

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data?: unknown };

const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown = {}) => {
  const response = {
    status,
    data,
    statusText: String(status),
    headers: {},
    config,
  } satisfies AxiosResponse;
  if (status >= 400) {
    return Promise.reject(
      new AxiosError(`HTTP ${status}`, String(status), config, undefined, response),
    );
  }
  return Promise.resolve(response);
};

const useServer = (handler: Handler) => {
  const calls: { url: string; authorization?: string }[] = [];
  apiClient.defaults.adapter = (config) => {
    const headers = AxiosHeaders.from(config.headers);
    calls.push({ url: config.url ?? '', authorization: headers.get('Authorization') as string });
    const { status, data } = handler(config);
    return respond(config, status, data);
  };
  return calls;
};

const user = (id: string) => ({
  id,
  email: `${id}@ecosoft.test`,
  firstName: id,
  lastName: 'Test',
  organizationId: null,
  authVersion: 1,
  roles: [],
  permissions: [],
});

describe('apiClient session handling', () => {
  let expired: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sessionStorage.clear();
    expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
  });
  afterEach(() => window.removeEventListener(SESSION_EXPIRED_EVENT, expired));

  it('shares a single refresh between concurrent 401 responses and replays with the new token', async () => {
    authStorage.setToken('old');
    let refreshes = 0;
    const calls = useServer((config) => {
      if (config.url === '/auth/refresh') {
        refreshes += 1;
        return { status: 200, data: { accessToken: 'new', user: user('a') } };
      }
      const auth = AxiosHeaders.from(config.headers).get('Authorization');
      return auth === 'Bearer new' ? { status: 200, data: { ok: true } } : { status: 401 };
    });

    const [first, second] = await Promise.all([apiClient.get('/bids'), apiClient.get('/auctions')]);
    expect(first.data).toEqual({ ok: true });
    expect(second.data).toEqual({ ok: true });
    expect(refreshes).toBe(1);
    expect(authStorage.getToken()).toBe('new');
    expect(calls.filter((call) => call.authorization === 'Bearer new')).toHaveLength(2);
    expect(expired).not.toHaveBeenCalled();
  });

  it('ends the session when the refresh fails', async () => {
    authStorage.setToken('old');
    useServer(() => ({ status: 401 }));
    await expect(apiClient.get('/bids')).rejects.toBeInstanceOf(Error);
    expect(authStorage.getToken()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('does not log out a newer identity because of a late 401 from the previous one', async () => {
    authStorage.setToken('token-user-a');
    useServer((config) => {
      if (config.url === '/auth/refresh') {
        // Meanwhile user B signed in on this tab.
        authStorage.setToken('token-user-b');
        return { status: 401 };
      }
      return { status: 401 };
    });
    await expect(apiClient.get('/bids')).rejects.toBeInstanceOf(Error);
    expect(authStorage.getToken()).toBe('token-user-b');
    expect(expired).not.toHaveBeenCalled();
  });

  it('keeps the session when the replayed request is forbidden', async () => {
    authStorage.setToken('old');
    useServer((config) =>
      config.url === '/auth/refresh'
        ? { status: 200, data: { accessToken: 'new', user: user('a') } }
        : AxiosHeaders.from(config.headers).get('Authorization') === 'Bearer new'
          ? { status: 403 }
          : { status: 401 },
    );
    await expect(apiClient.get('/audit')).rejects.toMatchObject({ response: { status: 403 } });
    expect(authStorage.getToken()).toBe('new');
    expect(expired).not.toHaveBeenCalled();
  });

  it('never tries to refresh failed credentials', async () => {
    let refreshes = 0;
    useServer((config) => {
      if (config.url === '/auth/refresh') refreshes += 1;
      return { status: 401 };
    });
    await expect(apiClient.post('/auth/login', {})).rejects.toBeInstanceOf(Error);
    expect(refreshes).toBe(0);
    expect(expired).not.toHaveBeenCalled();
  });
});
