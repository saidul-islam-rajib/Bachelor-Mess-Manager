import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ROUTES } from '@/lib/routes';
import { timeAgo, useInvitations } from '@/components/InvitationsProvider';
import { useNotifications, type AppNotification } from '@/components/NotificationsProvider';
import InvitationCard from '@/components/InvitationCard';

export default function NotificationBell() {
  const { invitations, count: invitationCount, loading: invitationsLoading } = useInvitations();
  const { notifications, unreadCount, loading: notificationsLoading, refresh, markRead, markAllRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const count = invitationCount + unreadCount;
  const loading = invitationsLoading || notificationsLoading;
  const hasAnything = invitationCount > 0 || notifications.length > 0;

  const visible = useMemo(() => notifications.slice(0, 12), [notifications]);

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
    if (open) refresh();
  }, [open, refresh]);

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
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
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
        <div className="absolute right-0 z-50 mt-2 w-[24rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="rounded-full px-2 py-0.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {loading && !hasAnything ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Loading...</p>
            ) : !hasAnything ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-slate-600">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-slate-400">Invitations and mess updates show up here.</p>
              </div>
            ) : (
              <>
                {invitationCount > 0 && (
                  <ul className="divide-y divide-slate-100 border-b border-slate-100">
                    {invitations.map((invitation) => (
                      <li key={invitation.id}>
                        <InvitationCard invitation={invitation} compact />
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="divide-y divide-slate-100">
                  {visible.map((notification) => (
                    <li key={notification.id}>
                      <NotificationRow
                        notification={notification}
                        onOpen={() => {
                          markRead([notification.id]);
                          setOpen(false);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </>
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

function NotificationRow({ notification, onOpen }: { notification: AppNotification; onOpen: () => void }) {
  const unread = !notification.readAt;

  const inner = (
    <div className={`flex gap-3 px-4 py-3 ${unread ? 'bg-slate-50/80' : ''}`}>
      <span
        aria-hidden
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-slate-900' : 'bg-transparent'}`}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug text-slate-900">{notification.title}</p>
        {notification.body && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{notification.body}</p>}
        <p className="mt-1 text-[11px] text-slate-400">
          {notification.group ? `${notification.group.name} · ` : ''}
          {timeAgo(notification.createdAt)}
        </p>
      </div>
    </div>
  );

  if (!notification.link) {
    return (
      <button type="button" onClick={onOpen} className="block w-full text-left transition-colors hover:bg-slate-50">
        {inner}
      </button>
    );
  }

  return (
    <Link href={notification.link} onClick={onOpen} className="block transition-colors hover:bg-slate-50">
      {inner}
    </Link>
  );
}
