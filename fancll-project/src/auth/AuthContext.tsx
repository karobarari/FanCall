import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiGet, apiPost } from '../lib/api';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean; // true while the initial session check is in flight
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: if the browser has a session cookie, ask the API who we are.
  // A 401 here just means "no valid session" — not an error.
  useEffect(() => {
    let cancelled = false;
    apiGet<{ user: User }>('/auth/me')
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        // 401 / network error — treat as logged out.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await apiPost<{ user: User }>('/auth/login', { email, password });
    setUser(user);
  }, []);

  const signup = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { user } = await apiPost<{ user: User }>('/auth/signup', {
        email,
        password,
        displayName,
      });
      setUser(user);
    },
    []
  );

  const logout = useCallback(async () => {
    await apiPost<unknown>('/auth/logout', {});
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, signup, logout }),
    [user, loading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
