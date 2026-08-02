import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { api } from '@/lib/api-client';
import { communityConfig } from '@/config';

type CommunityContextValue = {
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: () => Promise<void>;
  setUnreadCount: (count: number) => void;
};

const CommunityContext = createContext<CommunityContextValue | null>(null);

export function useCommunity(): CommunityContextValue {
  const context = useContext(CommunityContext);
  if (!context) {
    throw new Error('useCommunity must be used within a CommunityProvider');
  }
  return context;
}

export function CommunityProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const data = await api.get<{ unreadCount: number }>('/api/community/read');
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  const markRead = useCallback(async () => {
    if (!user) return;
    setUnreadCount(0);
    try {
      await api.post('/api/community/read');
    } catch {
      await refresh();
    }
  }, [refresh, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    const timer = setInterval(refresh, communityConfig.pollIntervalMs);
    const onFocus = () => refresh();

    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh, user]);

  const value = useMemo(
    () => ({ unreadCount, refresh, markRead, setUnreadCount }),
    [markRead, refresh, unreadCount]
  );

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}
