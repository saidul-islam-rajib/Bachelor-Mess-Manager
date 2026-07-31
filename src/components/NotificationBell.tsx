import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ROUTES } from '@/lib/routes';
import { useInvitations, type Invitation } from '@/components/InvitationsProvider';
import { useNotifications, type AppNotification } from '@/components/NotificationsProvider';
import InvitationCard from '@/components/InvitationCard';
import NotificationCard from '@/components/NotificationCard';

type FeedItem =
  | { kind: 'invitation'; id: string; createdAt: string; invitation: Invitation }
  | { kind: 'notification'; id: string; createdAt: string; notification: AppNotification };

export default function NotificationBell() {
  const { invitations, count: invitationCount, loading: loadingInvitations } = useInvitations();
  const { notifications, unreadCount, loading: loadingNotifications, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const count = invitationCount + unreadCount;
  const loading = loadingInvitations || loadingNotifications;

  const items = useMemo<FeedItem[]>(() => {
    const merged: FeedItem[] = [
      ...invitations.map((invitation) => ({
        kind: 'invitation' as const,
        id: `invitation-${invitation.id}`,
        createdAt: invitation.createdAt,
        invitation
      })),
      ...notifications.map((notification) => ({
        kind: 'notification' as const,
        id: `notification-${notification.id}`,
        createdAt: notification.createdAt,
        notification
      }))
    ];

    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [invitations, notifications]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on('routeChangeComplete', close);
    return () => router.events.off('routeChangeComplete', close);
  }, [router.events]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Notifications, ${count} pending` : 'Notifications'}
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{count} new</span>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Loading...</p>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-slate-600">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-slate-400">Invitations and mentions will show up here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.kind === 'invitation' ? (
                      <InvitationCard invitation={item.invitation} compact />
                    ) : (
                      <NotificationCard notification={item.notification} onNavigate={() => setOpen(false)} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5">
            <Link
              href={ROUTES.profile}
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Manage in profile →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
