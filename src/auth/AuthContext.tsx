import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiGet, apiPatch, apiPost } from '../lib/api';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  // Preset avatar id "<color>-<icon>", or null for the initials fallback.
  avatar: string | null;
  team_id: string;
  team_name: string;
  paid: boolean;
  is_admin: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean; // true while the initial session check is in flight
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (fields: { displayName?: string; avatar?: string | null }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  // Re-checks who's signed in against the session cookie. Used after a flow
  // that sets the cookie outside AuthContext's own login/signup calls — e.g.
  // finishing the OAuth "pick a team" step.
  refreshMe: () => Promise<void>;
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

  const signup = useCallback(async (email: string, password: string, displayName: string) => {
    const { user } = await apiPost<{ user: User }>('/auth/signup', { email, password, displayName });
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await apiPost<unknown>('/auth/logout', {});
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { user } = await apiGet<{ user: User }>('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(
    async (fields: { displayName?: string; avatar?: string | null }) => {
      const { user } = await apiPatch<{ user: User }>('/auth/me', fields);
      setUser(user);
    },
    []
  );

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await apiPatch<{ ok: boolean }>('/auth/me/password', { currentPassword, newPassword });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, signup, logout, refreshMe, updateProfile, changePassword }),
    [user, loading, login, signup, logout, refreshMe, updateProfile, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
