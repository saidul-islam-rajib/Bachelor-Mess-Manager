import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadSavedServer, setToken, setUnauthorizedHandler } from '@/core/api/client';
import { storage, STORAGE_KEYS } from '@/core/storage';
import * as authApi from '@/features/auth/api';
import type { SessionUser } from '@/features/auth/schemas';

const USER_KEY = 'auth.user';

type AuthState = {
  ready: boolean;
  user: SessionUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  const clear = useCallback(async () => {
    setToken(null);
    await storage.remove(STORAGE_KEYS.token);
    await storage.remove(USER_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clear();
    });
    (async () => {
      await loadSavedServer();
      const saved = await storage.get(STORAGE_KEYS.token);
      const savedUser = await storage.get(USER_KEY);
      if (saved && savedUser) {
        try {
          setToken(saved);
          setUser(JSON.parse(savedUser) as SessionUser);
        } catch {
          setToken(null);
        }
      }
      setReady(true);
    })();
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    await storage.set(STORAGE_KEYS.token, res.token);
    await storage.set(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
    }
    await clear();
  }, [clear]);

  const value = useMemo(() => ({ ready, user, signIn, signOut }), [ready, user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
