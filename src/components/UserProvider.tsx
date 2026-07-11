import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  profileImage?: string | null;
} | null;

type UserContextValue = {
  user: CurrentUser;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function useCurrentUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useCurrentUser must be used within a UserProvider');
  }
  return ctx;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/auth/login';
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <UserContext.Provider value={{ user, loading, refresh, logout }}>{children}</UserContext.Provider>;
}
