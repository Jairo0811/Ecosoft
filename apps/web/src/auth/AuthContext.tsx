import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SessionUser } from '@ecosoft/shared';
import { apiClient, authStorage } from '../api/client';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    const restore = async () => {
      if (!authStorage.getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await apiClient.get<{ user: SessionUser }>('/auth/me');
        setUser(data.user);
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    };
    void restore();
  }, [clearSession]);

  useEffect(() => {
    window.addEventListener('ecosoft:session-expired', clearSession);
    return () => window.removeEventListener('ecosoft:session-expired', clearSession);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post<{ accessToken: string; user: SessionUser }>(
      '/auth/login',
      { email, password },
    );
    authStorage.setToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout', {}, { headers: { 'X-Requested-With': 'EcoSoftWeb' } });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return context;
}
