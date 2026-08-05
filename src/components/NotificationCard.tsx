import Link from 'next/link';
import { timeAgo } from '@/components/InvitationsProvider';
import { useNotifications, type AppNotification } from '@/components/NotificationsProvider';
import { strings } from '@/lib/i18n';

const ACTIONS: Record<string, string> = strings.notifications.actions;

export default function NotificationCard({
  notification,
  onNavigate
}: {
  notification: AppNotification;
  onNavigate?: () => void;
}) {
  const { markRead } = useNotifications();

  return (
    <Link
      href={notification.link}
      onClick={() => {
        if (!notification.read) markRead(notification.id);
        onNavigate?.();
      }}
      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
        notification.read ? '' : 'bg-slate-50/70'
      }`}
    >
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
        {notification.actorName.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        {notification.title ? (
          <p className="text-sm font-semibold leading-snug text-slate-900">{notification.title}</p>
        ) : (
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{notification.actorName}</span>{' '}
            {ACTIONS[notification.type] ?? strings.notifications.defaultAction}
            {notification.groupName && (
              <>
                {` ${strings.notifications.inGroup} `}
                <span className="font-semibold text-slate-900">{notification.groupName}</span>
              </>
            )}
          </p>
        )}
        {notification.excerpt && (
          <p className={`mt-0.5 text-xs text-slate-500 ${notification.title ? '' : 'truncate'}`}>
            {notification.excerpt}
          </p>
        )}
        <p className="mt-0.5 text-xs text-slate-400">
          {notification.title && notification.groupName ? `${notification.groupName} · ` : ''}
          {timeAgo(notification.createdAt)}
        </p>
      </div>
      {!notification.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
    </Link>
  );
}
