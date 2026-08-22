import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ROUTES } from '@/lib/routes';
import { strings } from '@/lib/i18n';
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
  const [anchorTop, setAnchorTop] = useState(0);
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

  useEffect(() => {
    if (!open) return;

    const measure = () => {
      const rect = wrapper.current?.getBoundingClientRect();
      if (rect) setAnchorTop(rect.bottom + 8);
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Notifications, ${count} pending` : 'Notifications'}
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-slate-900">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/25 sm:hidden"
          />

          <div
            role="dialog"
            aria-label={strings.notifications.panelTitle}
            style={{ '--bell-top': `${anchorTop}px` } as CSSProperties}
            className="fixed inset-x-3 top-[var(--bell-top)] z-50 flex max-h-[calc(100dvh_-_var(--bell-top)_-_1rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-[22rem]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <p className="text-sm font-semibold">{strings.notifications.panelTitle}</p>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {strings.notifications.newCount(count)}
                  </span>
                )}
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead()}
                    className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    {strings.notifications.markAllRead}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain sm:max-h-96">
              {loading && items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">{strings.common.loading}</p>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{strings.notifications.caughtUp}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{strings.notifications.caughtUpHint}</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
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

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/50">
              <Link
                href={ROUTES.notifications}
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
              >
                {strings.notifications.seeAll} →
              </Link>
              <Link
                href={ROUTES.profile}
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                {strings.nav.profile}
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
