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

const copy = strings.admin.activity;

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

type DeviceVisitor = {
  userId: string;
  name: string;
  email: string;
  role: string;
  visits: number;
  seconds: number;
  lastSeenAt: string | null;
  firstSeenAt: string | null;
  online: boolean;
  totalVisits: number;
  share: number;
  otherDevices: string[];
};

type DeviceVisitorsResponse = {
  device: string;
  deviceLabel: string;
  visits: number;
  visitors: DeviceVisitor[];
  total: number;
  meta: PageMeta;
};

const LEADERBOARD_CAP = 100;

const RANGES = [
  { value: '7', label: copy.ranges.week },
  { value: '30', label: copy.ranges.month },
  { value: '90', label: copy.ranges.quarter },
  { value: '0', label: copy.ranges.all }
];

const SORTS = [
  { value: 'visits', label: copy.sorts.visits },
  { value: 'time', label: copy.sorts.time },
  { value: 'recent', label: copy.sorts.recent }
];

const RANK_TONES = ['bg-amber-100 text-amber-800', 'bg-slate-200 text-slate-700', 'bg-orange-100 text-orange-800'];

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = 60_000;
const RELATIVE_DAY_CUTOFF = 30;

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return strings.units.zeroMinutes;
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.round((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  if (hours === 0) return minutes === 0 ? strings.units.underAMinute : strings.units.minutesShort(minutes);
  return minutes === 0 ? strings.units.hoursShort(hours) : strings.units.hoursMinutesShort(hours, minutes);
}

function deviceLabel(device: string): string {
  return strings.devices[device as keyof typeof strings.devices] ?? device;
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function relative(iso: string | null): string {
  if (!iso) return strings.common.dash;
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / MS_PER_MINUTE);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return copy.minutesAgo(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return copy.hoursAgo(hours);
  const days = Math.round(hours / 24);
  return days < RELATIVE_DAY_CUTOFF ? copy.daysAgo(days) : formatDateTime(iso);
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
  const [openDevice, setOpenDevice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ActivityReport>('/api/admin/activity', {
        query: { days, sort, search: debouncedSearch || undefined }
      });
      setReport(data);
    } catch (error) {
      toast.error(errorMessage(error, strings.errors.loadFailed(strings.admin.tabs.activity)));
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

  const periodLabel = useMemo(
    () => RANGES.find((range) => range.value === days)?.label ?? days,
    [days]
  );

  const columns: Column<ActivityMember>[] = [
    {
      key: 'rank',
      header: copy.columns.rank,
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
      header: copy.columns.member,
      render: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{row.name}</span>
            {row.online && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {copy.online}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-slate-500">{row.email}</p>
        </div>
      )
    },
    { key: 'role', header: copy.columns.role, render: (row) => <Badge>{roleLabel(row.role)}</Badge> },
    {
      key: 'visits',
      header: copy.columns.visits,
      align: 'right',
      render: (row) => <span className="tabular-nums">{row.visits}</span>
    },
    {
      key: 'seconds',
      header: copy.columns.timeOnSite,
      align: 'right',
      render: (row) => <span className="tabular-nums font-medium">{formatDuration(row.seconds)}</span>
    },
    {
      key: 'average',
      header: copy.columns.averageVisit,
      align: 'right',
      render: (row) => <span className="tabular-nums text-slate-600">{formatDuration(row.averageSeconds)}</span>
    },
    {
      key: 'lastSeen',
      header: copy.columns.lastSeen,
      align: 'right',
      render: (row) => <span className="whitespace-nowrap text-slate-600">{relative(row.lastSeenAt)}</span>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button variant="secondary" size="sm" onClick={() => setOpenMember(row)}>
          {copy.visitsAction}
        </Button>
      )
    }
  ];

  if (loading && !report) return <LoadingCard />;
  if (!report) return <EmptyState title={copy.emptyTitle} description={copy.emptyBody} />;

  const { overview } = report;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={copy.title} description={copy.subtitle(overview.timeZone)} />
        <div className="mt-4">
          <FilterBar>
            <Listbox label={copy.period} value={days} onChange={setDays} options={RANGES} />
            <SearchInput value={search} onChange={setSearch} placeholder={copy.searchPlaceholder} />
          </FilterBar>
        </div>
      </Card>

      <StatGrid columns={4}>
        <StatCard label={copy.stats.visits} value={overview.visits.toLocaleString()} />
        <StatCard label={copy.stats.visitors} value={overview.visitors.toLocaleString()} />
        <StatCard label={copy.stats.totalTime} value={formatDuration(overview.seconds)} />
        <StatCard label={copy.stats.averageVisit} value={formatDuration(overview.averageSeconds)} />
        <StatCard
          label={copy.stats.onlineNow}
          value={overview.onlineNow.toLocaleString()}
          tone={overview.onlineNow > 0 ? 'green' : undefined}
        />
        <StatCard label={copy.stats.visitsToday} value={overview.visitsToday.toLocaleString()} />
        <StatCard
          label={copy.stats.neverVisited}
          value={overview.neverVisited.toLocaleString()}
          tone={overview.neverVisited > 0 ? 'amber' : undefined}
        />
        <StatCard
          label={copy.stats.rankedMembers}
          value={
            report.truncated
              ? copy.stats.rankedOf(report.members.length, LEADERBOARD_CAP)
              : report.members.length.toLocaleString()
          }
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={copy.timeOfDay.title} description={copy.timeOfDay.subtitle} />
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
            <p className="text-xs uppercase tracking-wide text-slate-500">{copy.hourByHour}</p>
            <div className="mt-3 flex h-24 items-end gap-[3px]">
              {report.byHour.map((hour) => (
                <div
                  key={hour.hour}
                  className="flex-1"
                  title={copy.hourTooltip(`${String(hour.hour).padStart(2, '0')}:00`, hour.visits)}
                >
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
          <CardHeader title={copy.weekdays.title} description={copy.weekdays.subtitle} />
          <div className="mt-5 space-y-3">
            {report.byWeekday.map((day) => (
              <Bar key={day.weekday} label={day.label} value={day.visits} max={weekdayMax} tone="bg-slate-400" />
            ))}
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">{copy.devices.title}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.byDevice.length === 0 && <p className="text-sm text-slate-400">{copy.devices.empty}</p>}
              {report.byDevice.map((device) => (
                <button
                  key={device.device}
                  type="button"
                  onClick={() => setOpenDevice(device.device)}
                  title={copy.devices.openHint(deviceLabel(device.device))}
                  className="inline-flex min-h-[2rem] items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm transition-colors hover:bg-brand-50 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  {deviceLabel(device.device)}
                  <span className="font-semibold tabular-nums">{device.visits}</span>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="text-slate-400"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {report.trend.length > 0 && (
        <Card>
          <CardHeader title={copy.trend.title} description={copy.trend.subtitle} />
          <div className="mt-5 flex items-start gap-3">
            <div className="flex h-32 w-8 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-slate-400">
              <span>{trendMax}</span>
              <span>{Math.round(trendMax / 2)}</span>
              <span>0</span>
            </div>
            <div className="flex h-32 flex-1 items-end gap-1 overflow-x-auto border-l border-b border-slate-200 pl-1">
              {report.trend.map((point) => (
                <div
                  key={point.day}
                  className="group relative flex h-full min-w-[12px] flex-1 flex-col justify-end"
                  title={copy.trendTooltip(point.day, point.visits, point.visitors)}
                >
                  <span className="mb-0.5 text-center text-[10px] font-medium tabular-nums text-slate-500">
                    {point.visits}
                  </span>
                  <div
                    className="relative w-full rounded-t bg-brand-500/30"
                    style={{ height: `${Math.max(3, Math.round((point.visits / trendMax) * 100))}%` }}
                  >
                    <div
                      className="absolute bottom-0 w-full rounded-t bg-brand-600"
                      style={{
                        height: `${point.visits > 0 ? Math.round((point.visitors / point.visits) * 100) : 0}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-11 text-[10px] text-slate-400">
            <span>{report.trend[0]?.day}</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-brand-600" aria-hidden /> people
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-brand-500/30" aria-hidden /> visits
              </span>
            </span>
            <span>{report.trend[report.trend.length - 1]?.day}</span>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title={copy.leaderboard.title}
          description={copy.leaderboard.subtitle(LEADERBOARD_CAP, report.truncated)}
          action={<Listbox label={copy.rankBy} value={sort} onChange={setSort} options={SORTS} />}
        />
        <div className="mt-5">
          <DataTable
            columns={columns}
            rows={report.members}
            rowKey={(row) => row.userId}
            loading={loading}
            emptyTitle={copy.leaderboard.emptyTitle}
            emptyDescription={copy.leaderboard.emptyBody}
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
                  {row.online && <Badge tone="success">{copy.online}</Badge>}
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {copy.cardSummary(row.visits, formatDuration(row.seconds), relative(row.lastSeenAt))}
                </p>
                <Button className="mt-3" variant="secondary" size="sm" onClick={() => setOpenMember(row)}>
                  {copy.visitsAction}
                </Button>
              </div>
            )}
          />
        </div>
      </Card>

      {openMember && <MemberVisitsModal member={openMember} onClose={() => setOpenMember(null)} />}

      {openDevice && (
        <DeviceVisitorsModal
          device={openDevice}
          days={days}
          sort={sort}
          search={debouncedSearch}
          periodLabel={periodLabel}
          onClose={() => setOpenDevice(null)}
          onOpenMember={(userId) => {
            const member = report.members.find((row) => row.userId === userId);
            if (member) {
              setOpenDevice(null);
              setOpenMember(member);
            }
          }}
        />
      )}
    </div>
  );
}

function DeviceVisitorsModal({
  device,
  days,
  sort,
  search,
  periodLabel,
  onClose,
  onOpenMember
}: {
  device: string;
  days: string;
  sort: string;
  search: string;
  periodLabel: string;
  onClose: () => void;
  onOpenMember: (userId: string) => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<DeviceVisitorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(paginationConfig.pageSize);

  useEffect(() => {
    setPage(1);
  }, [device, days, sort, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api
      .get<DeviceVisitorsResponse>('/api/admin/activity/devices', {
        query: { device, days, sort, search: search || undefined, page, pageSize }
      })
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
  }, [device, days, sort, search, page, pageSize, toast]);

  const columns: Column<DeviceVisitor>[] = [
    {
      key: 'name',
      header: copy.columns.member,
      render: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{row.name}</span>
            {row.online && <Badge tone="success">{copy.online}</Badge>}
          </p>
          <p className="truncate text-xs text-slate-500">{row.email}</p>
        </div>
      )
    },
    { key: 'role', header: copy.columns.role, render: (row) => <Badge>{roleLabel(row.role)}</Badge> },
    {
      key: 'visits',
      header: copy.columns.visits,
      align: 'right',
      render: (row) => (
        <div>
          <p className="tabular-nums font-medium">{row.visits}</p>
          <p className="text-xs text-slate-400">{copy.devices.share(row.share)}</p>
        </div>
      )
    },
    {
      key: 'seconds',
      header: copy.columns.timeOnSite,
      align: 'right',
      render: (row) => <span className="tabular-nums">{formatDuration(row.seconds)}</span>
    },
    {
      key: 'otherDevices',
      header: copy.columns.device,
      render: (row) =>
        row.otherDevices.length === 0 ? (
          <Badge tone="info">{copy.devices.onlyDevice}</Badge>
        ) : (
          <span className="text-xs text-slate-600">
            {copy.devices.alsoUses(row.otherDevices.map(deviceLabel).join(', '))}
          </span>
        )
    },
    {
      key: 'lastSeen',
      header: copy.columns.lastSeen,
      align: 'right',
      render: (row) => <span className="whitespace-nowrap text-slate-600">{relative(row.lastSeenAt)}</span>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button variant="secondary" size="sm" onClick={() => onOpenMember(row.userId)}>
          {copy.visitsAction}
        </Button>
      )
    }
  ];

  return (
    <Modal open onClose={onClose} title={copy.devices.modalTitle(deviceLabel(device))} size="lg">
      <p className="text-sm text-slate-500">
        {copy.devices.modalSubtitle(data?.visits ?? 0, data?.total ?? 0, periodLabel)}
      </p>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={data?.visitors ?? []}
          rowKey={(row) => row.userId}
          loading={loading}
          emptyTitle={copy.devices.emptyTitle}
          emptyDescription={copy.devices.emptyBody}
          renderCard={(row) => (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-xs text-slate-500">{row.email}</p>
                </div>
                {row.online && <Badge tone="success">{copy.online}</Badge>}
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {copy.cardSummary(row.visits, formatDuration(row.seconds), relative(row.lastSeenAt))}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {copy.devices.share(row.share)}
                {row.otherDevices.length > 0
                  ? ` · ${copy.devices.alsoUses(row.otherDevices.map(deviceLabel).join(', '))}`
                  : ` · ${copy.devices.onlyDevice}`}
              </p>
              <Button className="mt-3" variant="secondary" size="sm" onClick={() => onOpenMember(row.userId)}>
                {copy.visitsAction}
              </Button>
            </div>
          )}
        />
      </div>

      {data?.meta && data.meta.total > 0 && (
        <Pagination meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading} />
      )}
    </Modal>
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
    { key: 'startedAt', header: copy.columns.arrived, render: (row) => formatDateTime(row.startedAt) },
    {
      key: 'seconds',
      header: copy.columns.stayed,
      align: 'right',
      render: (row) => <span className="tabular-nums font-medium">{formatDuration(row.seconds)}</span>
    },
    { key: 'bucket', header: copy.columns.partOfDay, render: (row) => titleCase(row.bucket) },
    { key: 'device', header: copy.columns.device, render: (row) => deviceLabel(row.device) },
    {
      key: 'endedReason',
      header: copy.columns.ended,
      render: (row) =>
        row.endedAt ? (
          row.endedReason === 'LOGOUT' ? (
            copy.signedOut
          ) : (
            copy.wentIdle
          )
        ) : (
          <Badge tone="success">{copy.stillOpen}</Badge>
        )
    }
  ];

  return (
    <Modal open onClose={onClose} title={copy.memberVisitsTitle(member.name)} size="lg">
      <p className="text-sm text-slate-500">
        {copy.memberVisitsSubtitle(
          member.visits,
          formatDuration(member.seconds),
          member.firstSeenAt ? formatDateTime(member.firstSeenAt) : strings.common.dash
        )}
      </p>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={data?.visits ?? []}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle={copy.noVisitsTitle}
          emptyDescription={copy.noVisitsBody}
          renderCard={(row) => (
            <div className="rounded-2xl border border-slate-200 p-4 text-sm">
              <p className="font-medium">{formatDateTime(row.startedAt)}</p>
              <p className="mt-1 text-slate-600">
                {copy.columns.stayed} {formatDuration(row.seconds)} · {titleCase(row.bucket)} ·{' '}
                {deviceLabel(row.device)}
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
