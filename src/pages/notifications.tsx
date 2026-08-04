import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import NotificationCard from '@/components/NotificationCard';
import { useNotifications, type AppNotification } from '@/components/NotificationsProvider';
import { useInvitations } from '@/components/InvitationsProvider';
import { Button, EmptyState, Loader, PageContainer, PageHeader, Pagination } from '@/components/ui';
import { paginationConfig } from '@/config';
import { strings } from '@/lib/i18n';
import { ROUTES } from '@/lib/routes';
import type { PageMeta } from '@/lib/query';

type Filter = 'all' | 'unread';

const EMPTY_META: PageMeta = {
  page: 1,
  pageSize: paginationConfig.pageSize,
  total: 0,
  totalPages: 0,
  hasPrevious: false,
  hasNext: false,
  from: 0,
  to: 0
};

export default function NotificationsPage() {
  const { unreadCount, markAllRead } = useNotifications();
  const { count: invitationCount } = useInvitations();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_META);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(paginationConfig.pageSize);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filter === 'unread') params.set('unread', 'true');

      const res = await fetch(`/api/notifications?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      setItems(res.ok ? data.notifications ?? [] : []);
      setMeta(res.ok && data.meta ? data.meta : EMPTY_META);
    } finally {
      setLoading(false);
    }
  }, [filter, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  function changeFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  function changePageSize(next: number) {
    setPageSize(next);
    setPage(1);
  }

  async function markEverythingRead() {
    await markAllRead();
    await load();
  }

  function markOneRead(id: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  }

  return (
    <PageContainer>
      <PageHeader
        title={strings.notifications.title}
        description={strings.notifications.subtitle}
        action={
          unreadCount > 0 ? (
            <Button variant="secondary" size="sm" onClick={markEverythingRead}>
              {strings.notifications.markAllRead}
            </Button>
          ) : (
            <span className="text-sm text-slate-500">{strings.notifications.allRead}</span>
          )
        }
      />

      {invitationCount > 0 && (
        <Link
          href={ROUTES.invitations}
          className="mb-4 block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition-colors hover:bg-amber-100"
        >
          {strings.notifications.pendingInvitations(invitationCount)}
        </Link>
      )}

      <div className="mb-4 inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm">
        {([
          ['all', strings.notifications.filterAll],
          ['unread', `${strings.notifications.filterUnread}${unreadCount > 0 ? ` (${unreadCount})` : ''}`]
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => changeFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
              filter === value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading && items.length === 0 ? (
          <div className="p-6">
            <Loader />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={strings.notifications.caughtUp}
              description={filter === 'unread' ? strings.notifications.emptyUnread : strings.notifications.emptyAll}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id}>
                <NotificationCard notification={item} onNavigate={() => markOneRead(item.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={changePageSize} disabled={loading} />
    </PageContainer>
  );
}
