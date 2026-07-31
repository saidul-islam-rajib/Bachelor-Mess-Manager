import Link from 'next/link';
import { timeAgo } from '@/components/InvitationsProvider';
import { useNotifications, type AppNotification } from '@/components/NotificationsProvider';
import { NOTIFICATION_TYPES } from '@/lib/constants';

const ACTIONS: Record<string, string> = {
  [NOTIFICATION_TYPES.MENTION_COMMENT]: 'mentioned you in a comment',
  [NOTIFICATION_TYPES.MENTION_REPLY]: 'mentioned you in a reply',
  [NOTIFICATION_TYPES.MENTION_EXPENSE_COMMENT]: 'mentioned you in a bazar note'
};

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
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
        {notification.actorName.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{notification.actorName}</span>{' '}
          {ACTIONS[notification.type] ?? 'mentioned you'}
          {notification.groupName && (
            <>
              {' in '}
              <span className="font-semibold text-slate-900">{notification.groupName}</span>
            </>
          )}
        </p>
        {notification.excerpt && (
          <p className="mt-0.5 truncate text-xs text-slate-500">{notification.excerpt}</p>
        )}
        <p className="mt-0.5 text-xs text-slate-400">{timeAgo(notification.createdAt)}</p>
      </div>
      {!notification.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
    </Link>
  );
}
