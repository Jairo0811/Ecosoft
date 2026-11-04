import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SessionUser } from '@ecosoft/shared';
import {
  SESSION_EXPIRED_EVENT,
  apiClient,
  authStorage,
  refreshSession,
  trustedWebHeaders,
} from '../api/client';
import { resetSessionCache } from '../api/queryClient';

export type SessionEndReason = 'logout' | 'expired';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  /** Why the last session ended, so the login screen can explain it. */
  endReason: SessionEndReason | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);
  const identityRef = useRef<string | null>(null);

  /** Installs a new identity, purging every cached query that belonged to a different one. */
  const establish = useCallback(async (next: SessionUser) => {
    if (identityRef.current !== next.id) await resetSessionCache();
    identityRef.current = next.id;
    authStorage.setSessionHint(true);
    setEndReason(null);
    setUser(next);
  }, []);

  const endSession = useCallback(async (reason: SessionEndReason) => {
    authStorage.clear();
    authStorage.setSessionHint(false);
    identityRef.current = null;
    // Unmount protected screens first so no query re-subscribes while the cache is purged.
    setUser(null);
    setEndReason(reason);
    await resetSessionCache();
  }, []);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        // With a token, /auth/me validates it (and refreshes it once if expired).
        // Without one (new tab), try the httpOnly refresh cookie silently.
        // A cold visit with no session hint has no refresh cookie to try.
        if (!authStorage.getToken() && !authStorage.hasSessionHint()) return;
        const restored = authStorage.getToken()
          ? (await apiClient.get<{ user: SessionUser }>('/auth/me')).data.user
          : (await refreshSession()).user;
        if (active) await establish(restored);
      } catch {
        authStorage.clear();
        authStorage.setSessionHint(false);
      } finally {
        if (active) setLoading(false);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [establish]);

  useEffect(() => {
    const onExpired = () => void endSession('expired');
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [endSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await apiClient.post<{ accessToken: string; user: SessionUser }>(
        '/auth/login',
        { email, password },
      );
      authStorage.setToken(data.accessToken);
      await establish(data.user);
    },
    [establish],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout', {}, { headers: trustedWebHeaders });
    } catch {
      // The local session is terminated regardless; the server revokes by refresh cookie.
    } finally {
      await endSession('logout');
    }
  }, [endSession]);

  const hasPermission = useCallback(
    (permission: string) => Boolean(user?.permissions.includes(permission)),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, endReason, login, logout, hasPermission }),
    [user, loading, endReason, login, logout, hasPermission],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return context;
}
