import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCurrentUser } from '@/components/UserProvider';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
  group: { id: string; name: string } | null;
};

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const POLL_INTERVAL_MS = 60_000;

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return ctx;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    if (inFlight.current) return;

    inFlight.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=20');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      setLoading(false);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      refresh();
    };

    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [user, refresh]);

  const applyRead = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setNotifications((prev) =>
      prev.map((item) => (set.has(item.id) && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item))
    );
  }, []);

  const markRead = useCallback(
    async (ids: string[]) => {
      const unread = ids.filter((id) => notifications.find((n) => n.id === id && !n.readAt));
      if (unread.length === 0) return;

      applyRead(unread);
      setUnreadCount((prev) => Math.max(0, prev - unread.length));

      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: unread })
        });
      } catch {
        refresh();
      }
    },
    [notifications, applyRead, refresh]
  );

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.readAt).map((n) => n.id);
    if (unread.length === 0) return;

    applyRead(unread);
    setUnreadCount(0);

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true })
      });
    } catch {
      refresh();
    }
  }, [notifications, applyRead, refresh]);

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, refresh, markRead, markAllRead }),
    [notifications, unreadCount, loading, refresh, markRead, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
