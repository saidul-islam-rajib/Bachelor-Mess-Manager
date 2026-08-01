import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ImpersonatedBy = {
  id: string;
  name: string;
  email: string;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  profileImage?: string | null;
  impersonatedBy?: ImpersonatedBy;
} | null;

type UserContextValue = {
  user: CurrentUser;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  stopImpersonating: () => Promise<void>;
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

    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHES' });
    }

    window.location.href = '/auth/login';
  }, []);

  const stopImpersonating = useCallback(async () => {
    await fetch('/api/admin/impersonate', { method: 'DELETE' });
    window.location.href = '/admin';
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <UserContext.Provider value={{ user, loading, refresh, logout, stopImpersonating }}>
      {children}
    </UserContext.Provider>
  );
}
