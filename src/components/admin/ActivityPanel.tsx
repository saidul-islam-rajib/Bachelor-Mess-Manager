import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  FilterBar,
  Listbox,
  LoadingCard,
  Modal,
  Pagination,
  SearchInput,
  StatCard,
  StatGrid,
  useDebouncedValue,
  type Column
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api-client';
import { useToast } from '@/components/ToastProvider';
import { paginationConfig } from '@/config';
import { formatDateTime, roleLabel } from '@/lib/format';
import { strings } from '@/lib/i18n';
import type { PageMeta } from '@/lib/query';

type BucketRow = { key: string; label: string; window: string; visits: number; share: number };

type ActivityMember = {
  rank: number;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  visits: number;
  seconds: number;
  averageSeconds: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  online: boolean;
};

type ActivityReport = {
  range: { days: number | null; since: string | null };
  overview: {
    timeZone: string;
    visits: number;
    visitors: number;
    seconds: number;
    averageSeconds: number;
    onlineNow: number;
    visitsToday: number;
    neverVisited: number;
  };
  byBucket: BucketRow[];
  byHour: { hour: number; visits: number }[];
  byWeekday: { weekday: number; label: string; visits: number }[];
  byDevice: { device: string; visits: number }[];
  trend: { day: string; visits: number; visitors: number }[];
  members: ActivityMember[];
  truncated: boolean;
};

type MemberVisit = {
  id: string;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null;
  endedReason: string | null;
  seconds: number;
  bucket: string;
  device: string;
  ipAddress: string | null;
};

type VisitsResponse = {
  user: { id: string; name: string; email: string; role: string };
  visits: MemberVisit[];
  meta: PageMeta;
};

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '0', label: 'All time' }
];

const SORTS = [
  { value: 'visits', label: 'Most visits' },
  { value: 'time', label: 'Most time on site' },
  { value: 'recent', label: 'Most recently seen' }
];

const RANK_TONES = ['bg-amber-100 text-amber-800', 'bg-slate-200 text-slate-700', 'bg-orange-100 text-orange-800'];

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return minutes === 0 ? '<1m' : `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function relative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : formatDateTime(iso);
}

function Bar({ label, hint, value, max, tone = 'bg-brand-500' }: {
  label: string;
  hint?: string;
  value: number;
  max: number;
  tone?: string;
}) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100)) : 0;

  return (
    <div className="grid grid-cols-[7.5rem_1fr_4rem] items-center gap-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{label}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      <div className="h-2.5 rounded-full bg-slate-100">
        <div className={`h-2.5 rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <p className="text-right tabular-nums text-slate-600">{value}</p>
    </div>
  );
}

export default function ActivityPanel() {
  const toast = useToast();
  const [report, setReport] = useState<ActivityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [sort, setSort] = useState('visits');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [openMember, setOpenMember] = useState<ActivityMember | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ActivityReport>('/api/admin/activity', {
        query: { days, sort, search: debouncedSearch || undefined }
      });
      setReport(data);
    } catch (error) {
      toast.error(errorMessage(error, strings.errors.loadFailed('activity')));
    } finally {
      setLoading(false);
    }
  }, [days, sort, debouncedSearch, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const bucketMax = useMemo(
    () => Math.max(1, ...(report?.byBucket ?? []).map((b) => b.visits)),
    [report]
  );
  const weekdayMax = useMemo(
    () => Math.max(1, ...(report?.byWeekday ?? []).map((d) => d.visits)),
    [report]
  );
  const hourMax = useMemo(() => Math.max(1, ...(report?.byHour ?? []).map((h) => h.visits)), [report]);
  const trendMax = useMemo(() => Math.max(1, ...(report?.trend ?? []).map((t) => t.visits)), [report]);

  const columns: Column<ActivityMember>[] = [
    {
      key: 'rank',
      header: '#',
      render: (row) => (
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
            RANK_TONES[row.rank - 1] ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {row.rank}
        </span>
      )
    },
    {
      key: 'name',
      header: 'Member',
      render: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{row.name}</span>
            {row.online && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                online
              </span>
            )}
          </p>
          <p className="truncate text-xs text-slate-500">{row.email}</p>
        </div>
      )
    },
    { key: 'role', header: 'Role', render: (row) => <Badge>{roleLabel(row.role)}</Badge> },
    { key: 'visits', header: 'Visits', align: 'right', render: (row) => <span className="tabular-nums">{row.visits}</span> },
    {
      key: 'seconds',
      header: 'Time on site',
      align: 'right',
      render: (row) => <span className="tabular-nums font-medium">{formatDuration(row.seconds)}</span>
    },
    {
      key: 'average',
      header: 'Average visit',
      align: 'right',
      render: (row) => <span className="tabular-nums text-slate-600">{formatDuration(row.averageSeconds)}</span>
    },
    {
      key: 'lastSeen',
      header: 'Last seen',
      align: 'right',
      render: (row) => <span className="whitespace-nowrap text-slate-600">{relative(row.lastSeenAt)}</span>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button variant="secondary" size="sm" onClick={() => setOpenMember(row)}>
          Visits
        </Button>
      )
    }
  ];

  if (loading && !report) return <LoadingCard />;
  if (!report) return <EmptyState title="No activity yet" description="Nothing has been recorded so far." />;

  const { overview } = report;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Who is using Bachelor Point"
          description={`Every visit by a signed-in member, counted in ${overview.timeZone}. A visit ends after 30 minutes without activity.`}
        />
        <div className="mt-4">
          <FilterBar>
            <Listbox label="Period" value={days} onChange={setDays} options={RANGES} />
            <SearchInput value={search} onChange={setSearch} placeholder="Search name or email" />
          </FilterBar>
        </div>
      </Card>

      <StatGrid columns={4}>
        <StatCard label="Visits" value={overview.visits.toLocaleString()} />
        <StatCard label="People who visited" value={overview.visitors.toLocaleString()} />
        <StatCard label="Total time on site" value={formatDuration(overview.seconds)} />
        <StatCard label="Average visit" value={formatDuration(overview.averageSeconds)} />
        <StatCard label="Online now" value={overview.onlineNow.toLocaleString()} tone={overview.onlineNow > 0 ? 'green' : undefined} />
        <StatCard label="Visits today" value={overview.visitsToday.toLocaleString()} />
        <StatCard
          label="Never visited"
          value={overview.neverVisited.toLocaleString()}
          tone={overview.neverVisited > 0 ? 'amber' : undefined}
        />
        <StatCard label="Ranked members" value={`${report.members.length}${report.truncated ? ' of 100+' : ''}`} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="What time people come" description="When a visit started, by local time of day." />
          <div className="mt-5 space-y-3">
            {report.byBucket.map((bucket) => (
              <Bar
                key={bucket.key}
                label={bucket.label}
                hint={`${bucket.window} · ${bucket.share}%`}
                value={bucket.visits}
                max={bucketMax}
              />
            ))}
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Hour by hour</p>
            <div className="mt-3 flex h-24 items-end gap-[3px]">
              {report.byHour.map((hour) => (
                <div key={hour.hour} className="flex-1" title={`${String(hour.hour).padStart(2, '0')}:00 — ${hour.visits} visits`}>
                  <div
                    className="w-full rounded-t bg-brand-500/80"
                    style={{ height: `${Math.max(hour.visits > 0 ? 4 : 1, Math.round((hour.visits / hourMax) * 100))}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Which days" description="Visits by day of the week." />
          <div className="mt-5 space-y-3">
            {report.byWeekday.map((day) => (
              <Bar key={day.weekday} label={day.label} value={day.visits} max={weekdayMax} tone="bg-slate-400" />
            ))}
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Devices</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.byDevice.length === 0 && <p className="text-sm text-slate-400">Nothing recorded yet.</p>}
              {report.byDevice.map((device) => (
                <span key={device.device} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                  {device.device.charAt(0) + device.device.slice(1).toLowerCase()}
                  <span className="ml-2 font-semibold tabular-nums">{device.visits}</span>
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {report.trend.length > 0 && (
        <Card>
          <CardHeader title="Day by day" description="Visits and how many different people made them." />
          <div className="mt-5 flex h-28 items-end gap-1 overflow-x-auto">
            {report.trend.map((point) => (
              <div
                key={point.day}
                className="flex min-w-[10px] flex-1 flex-col justify-end"
                title={`${point.day} — ${point.visits} visits from ${point.visitors} people`}
              >
                <div
                  className="w-full rounded-t bg-brand-500"
                  style={{ height: `${Math.max(4, Math.round((point.visits / trendMax) * 100))}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{report.trend[0]?.day}</span>
            <span>{report.trend[report.trend.length - 1]?.day}</span>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Top members"
          description={`Ranked 1 to 100${report.truncated ? ' — more members fell outside the top 100' : ''}.`}
          action={
            <Listbox label="Rank by" value={sort} onChange={setSort} options={SORTS} />
          }
        />
        <div className="mt-5">
          <DataTable
            columns={columns}
            rows={report.members}
            rowKey={(row) => row.userId}
            loading={loading}
            emptyTitle="Nobody has visited in this period"
            emptyDescription="Try a longer period."
            renderCard={(row) => (
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="mr-2 text-slate-400">#{row.rank}</span>
                      {row.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">{row.email}</p>
                  </div>
                  {row.online && <Badge tone="success">online</Badge>}
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {row.visits} visits · {formatDuration(row.seconds)} on site · last {relative(row.lastSeenAt)}
                </p>
                <Button className="mt-3" variant="secondary" size="sm" onClick={() => setOpenMember(row)}>
                  Visits
                </Button>
              </div>
            )}
          />
        </div>
      </Card>

      {openMember && <MemberVisitsModal member={openMember} onClose={() => setOpenMember(null)} />}
    </div>
  );
}

function MemberVisitsModal({ member, onClose }: { member: ActivityMember; onClose: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<VisitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(paginationConfig.pageSize);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<VisitsResponse>(`/api/admin/activity/${member.userId}`, { query: { page, pageSize } })
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [member.userId, page, pageSize, toast]);

  const columns: Column<MemberVisit>[] = [
    { key: 'startedAt', header: 'Arrived', render: (row) => formatDateTime(row.startedAt) },
    {
      key: 'seconds',
      header: 'Stayed',
      align: 'right',
      render: (row) => <span className="tabular-nums font-medium">{formatDuration(row.seconds)}</span>
    },
    { key: 'bucket', header: 'Part of day', render: (row) => row.bucket.charAt(0) + row.bucket.slice(1).toLowerCase() },
    { key: 'device', header: 'Device', render: (row) => row.device.charAt(0) + row.device.slice(1).toLowerCase() },
    {
      key: 'endedReason',
      header: 'Ended',
      render: (row) =>
        row.endedAt ? (row.endedReason === 'LOGOUT' ? 'Signed out' : 'Went idle') : <Badge tone="success">Still open</Badge>
    }
  ];

  return (
    <Modal open onClose={onClose} title={`${member.name} — visits`} size="lg">
      <p className="text-sm text-slate-500">
        {member.visits} visits in the selected period · {formatDuration(member.seconds)} on site · first seen{' '}
        {member.firstSeenAt ? formatDateTime(member.firstSeenAt) : '—'}
      </p>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={data?.visits ?? []}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle="No visits recorded"
          emptyDescription="This account has not been seen since visit tracking started."
          renderCard={(row) => (
            <div className="rounded-2xl border border-slate-200 p-4 text-sm">
              <p className="font-medium">{formatDateTime(row.startedAt)}</p>
              <p className="mt-1 text-slate-600">
                Stayed {formatDuration(row.seconds)} · {row.bucket.toLowerCase()} · {row.device.toLowerCase()}
              </p>
            </div>
          )}
        />
      </div>

      {data?.meta && data.meta.total > 0 && (
        <Pagination meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}
    </Modal>
  );
}
