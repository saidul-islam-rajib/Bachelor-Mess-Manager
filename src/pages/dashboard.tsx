import Link from 'next/link';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import MealPromptsPanel from '@/components/MealPromptsPanel';
import MealRateChart, { type MealRateChartDay } from '@/components/dashboard/MealRateChart';
import { ActionLink, LinkButton, Listbox } from '@/components/ui';
import { commentsAnchorPath, groupPath, ROUTES } from '@/lib/routes';
import { strings } from '@/lib/i18n';
import { expenseTypeLabel, USER_ROLES } from '@/lib/constants';
import { currentMonthKey, monthOptions } from '@/lib/month';
import { formatCurrency, formatDayKey, formatMonthLabel } from '@/lib/format';

const taka = formatCurrency;

const dashboardStrings = strings.dashboard;

type AdminReport = {
  pendingApprovals: number;
  members: number;
  supervisors: number;
  activeGroups: number;
  inactiveGroups: number;
  activeMemberships: number;
};

type GroupCard = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  meals: number;
  mealRate: number;
  highestDayRate: number;
  lowestDayRate: number;
  rateMode: string;
  bazar: number;
  bazarPaid: number;
  bazarOutstanding: number;
  bills: number;
  billsCollected: number;
  billsOutstanding: number;
  rent: number;
  additional: number;
  expense: number;
  collected: number;
  outstanding: number;
  byType: Record<string, number>;
  days: MealRateChartDay[];
};

type SupervisorReport = {
  groups: GroupCard[];
  totals: {
    groups: number;
    members: number;
    meals: number;
    mealRate: number;
    highestGroupRate: number;
    lowestGroupRate: number;
    bazar: number;
    bazarPaid: number;
    bazarOutstanding: number;
    bills: number;
    billsCollected: number;
    billsOutstanding: number;
    rent: number;
    additional: number;
    expense: number;
    collected: number;
    outstanding: number;
  };
  byType: Record<string, number>;
  unpaid: { groupId: string; groupName: string; id: string; name: string; due: number; status: string }[];
  longestStaying: { id: string; name: string; groupName: string; days: number }[];
};

type MemberReport = {
  group: { id: string; name: string; memberCount: number; joinedAt: string; stayDays: number; card: GroupCard } | null;
  pendingInvitations: number;
  current: {
    meals: number;
    mealCost: number;
    billShare: number;
    totalCost: number;
    bazarPaid: number;
    collected: number;
    due: number;
    status: string;
    mealRate: number;
    rateMode: string;
    dailyRate: { date: string; rate: number; isToday: boolean } | null;
    groupMeals: number;
    groupExpense: number;
    groupBazar: number;
    groupBills: number;
    byType: Record<string, number>;
    members: { id: string; name: string; meals: number; totalCost: number; due: number; status: string }[];
  } | null;
  previous: {
    month: string;
    meals: number;
    totalCost: number;
    due: number;
    mealRate: number;
    groupExpense: number;
  } | null;
};

type DashboardData = {
  role: string;
  month: string;
  admin?: AdminReport;
  supervisor?: SupervisorReport;
  member?: MemberReport;
};

export default function DashboardPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [month, setMonth] = useState(currentMonthKey());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetch(`/api/reports/dashboard?month=${month}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? 'Could not load your dashboard.');
        return body as DashboardData;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month]);

  return (
    <section className="mx-auto max-w-content px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{dashboardStrings.title}</h1>
          <p className="mt-1 text-slate-600">
            {user ? dashboardStrings.signedInAs(user.name, user.role.toLowerCase()) : dashboardStrings.subtitle}
          </p>
        </div>

        {data?.role !== USER_ROLES.ADMIN && (
          <Listbox
            className="w-full sm:w-56"
            label={strings.common.month}
            value={month}
            onChange={setMonth}
            options={monthOptions().map((option) => ({ value: option.key, label: option.label }))}
          />
        )}
      </div>

      {user && (
        <div className="mb-6 lg:hidden">
          <MealPromptsPanel />
        </div>
      )}

      {userLoading || loading ? (
        <Panel>Loading...</Panel>
      ) : error ? (
        <Panel>{error}</Panel>
      ) : !data ? (
        <Panel>Please sign in.</Panel>
      ) : data.admin ? (
        <AdminDashboard report={data.admin} />
      ) : data.supervisor ? (
        <SupervisorDashboard report={data.supervisor} />
      ) : data.member ? (
        <MemberDashboard report={data.member} currentUserId={user?.id} />
      ) : (
        <Panel>Nothing to show yet.</Panel>
      )}
    </section>
  );
}

function AdminDashboard({ report }: { report: AdminReport }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pending approvals" value={report.pendingApprovals} tone={report.pendingApprovals > 0 ? 'amber' : undefined} />
        <Stat label="Approved members" value={report.members} />
        <Stat label="Supervisors" value={report.supervisors} />
        <Stat label="Active groups" value={report.activeGroups} />
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Admin tools</h2>
        <p className="mt-1 text-sm text-slate-500">
          {report.pendingApprovals > 0
            ? `${report.pendingApprovals} registration${report.pendingApprovals === 1 ? '' : 's'} waiting for a decision.`
            : 'Approve registrations, manage users and groups, and edit site settings.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton href={ROUTES.admin}>Open admin dashboard</LinkButton>
          <LinkButton href={ROUTES.members} variant="secondary">
            All groups
          </LinkButton>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">System</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Inactive groups" value={String(report.inactiveGroups)} />
          <Field label="Active memberships" value={String(report.activeMemberships)} />
          <Field label="Total accounts" value={String(report.members + report.supervisors)} />
        </dl>
      </Card>
    </div>
  );
}

function SupervisorDashboard({ report }: { report: SupervisorReport }) {
  const { totals } = report;
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const allExpanded = report.groups.length > 0 && report.groups.every((group) => openIds.has(group.id));

  function toggleGroup(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 lg:col-span-2 sm:gap-4">
          <Stat label="Your groups" value={`${totals.groups} / 10`} />
          <Stat label="Members" value={totals.members} />
          <Stat label="Meal rate" value={taka(totals.mealRate)} />
          <Stat
            label="Outstanding dues"
            value={taka(totals.outstanding)}
            tone={totals.outstanding > 0 ? 'red' : 'green'}
          />
          {totals.groups > 1 && (
            <>
              <Stat label="Highest group rate" value={taka(totals.highestGroupRate)} />
              <Stat label="Lowest group rate" value={taka(totals.lowestGroupRate)} />
            </>
          )}
        </div>

        <QuickActions
          items={[
            {
              href: ROUTES.expenses,
              label: dashboardStrings.actions.logBazar,
              hint: dashboardStrings.actions.logBazarHint,
              icon: 'cart'
            },
            {
              href: ROUTES.meals,
              label: dashboardStrings.actions.enterMeals,
              hint: dashboardStrings.actions.enterMealsHint,
              icon: 'bowl'
            },
            {
              href: ROUTES.payments,
              label: dashboardStrings.actions.recordPayment,
              hint: dashboardStrings.actions.recordPaymentHint,
              icon: 'cash'
            },
            {
              href: ROUTES.members,
              label: dashboardStrings.actions.inviteMember,
              hint: dashboardStrings.actions.inviteMemberHint,
              icon: 'user'
            }
          ]}
        />
      </div>

      <MoneyOverview
        label="Spent this month (all groups)"
        expense={totals.expense}
        bazar={totals.bazar}
        bazarPaid={totals.bazarPaid}
        bazarOutstanding={totals.bazarOutstanding}
        bills={totals.bills}
        billsCollected={totals.billsCollected}
        billsOutstanding={totals.billsOutstanding}
        rent={totals.rent}
        additional={totals.additional}
      />

      <CostBreakdown byType={report.byType} total={totals.expense} />

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Your groups</h2>
          <div className="flex items-center gap-3">
            {report.groups.length > 1 && (
              <button
                type="button"
                onClick={() => setOpenIds(allExpanded ? new Set() : new Set(report.groups.map((group) => group.id)))}
                className="inline-flex min-h-[2rem] items-center rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            )}
            <ActionLink href={ROUTES.members}>Manage</ActionLink>
          </div>
        </div>

        {report.groups.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              You haven&apos;t created a group yet. Head to Members to create your first mess.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {report.groups.map((group) => (
              <SupervisorGroupCard
                key={group.id}
                card={group}
                open={openIds.has(group.id)}
                onToggle={() => toggleGroup(group.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Who still owes</h2>
          {report.unpaid.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Everyone is settled up this month.</p>
          ) : (
            <PagedList
              items={report.unpaid}
              pageSize={6}
              keyOf={(row) => `${row.groupId}-${row.id}`}
              renderItem={(row) => (
                <li className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="truncate text-xs text-slate-500">{row.groupName}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-red-600">{taka(row.due)}</span>
                </li>
              )}
            />
          )}
          <ActionLink href={ROUTES.payments} className="mt-4">
            Record a payment
          </ActionLink>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Longest staying members</h2>
          {report.longestStaying.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No members yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {report.longestStaying.map((row) => (
                <li key={`${row.groupName}-${row.id}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="truncate text-xs text-slate-500">{row.groupName}</p>
                  </div>
                  <span className="shrink-0 text-sm text-slate-600">{formatStay(row.days)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function SupervisorGroupCard({
  card,
  open,
  onToggle
}: {
  card: GroupCard;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-left sm:p-6"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold">{card.name}</h3>
            {card.status === 'INACTIVE' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">inactive</span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">
            {card.memberCount} member{card.memberCount === 1 ? '' : 's'} · {taka(card.mealRate)} / meal
            {card.outstanding > 0 && <span className="text-red-600"> · {taka(card.outstanding)} outstanding</span>}
          </p>
        </div>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-100 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <GroupStatsPanel card={card} />
          <ActionLink href={groupPath(card.id)}>Open group</ActionLink>
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' | 'amber' }) {
  const color =
    tone === 'green'
      ? 'text-green-700'
      : tone === 'red'
        ? 'text-red-600'
        : tone === 'amber'
          ? 'text-amber-600'
          : 'text-slate-900';
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base ${color}`}>{value}</p>
    </div>
  );
}

type MoneyRowsProps = {
  bazar: number;
  bazarPaid: number;
  bazarOutstanding: number;
  bills: number;
  billsCollected: number;
  billsOutstanding: number;
  rent: number;
  additional: number;
};

function MoneyRows({
  bazar,
  bazarPaid,
  bazarOutstanding,
  bills,
  billsCollected,
  billsOutstanding,
  rent,
  additional
}: MoneyRowsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Meal cost (bazar)</h4>
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          <MiniStat label="Total" value={taka(bazar)} />
          <MiniStat label="Fronted by members" value={taka(bazarPaid)} tone="green" />
          <MiniStat label="Yet to recover" value={taka(bazarOutstanding)} tone={bazarOutstanding > 0 ? 'amber' : 'green'} />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bills (rent, utilities &amp; more)</h4>
        <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <MiniStat label="Rent" value={taka(rent)} />
          <MiniStat label="Additional" value={taka(additional)} />
          <MiniStat label="Total bills" value={taka(bills)} />
          <MiniStat label="Collected" value={taka(billsCollected)} tone="green" />
          <MiniStat label="Outstanding" value={taka(billsOutstanding)} tone={billsOutstanding > 0 ? 'red' : 'green'} />
        </div>
      </div>
    </div>
  );
}

function MoneyOverview({ label, expense, ...rows }: { label: string; expense: number } & MoneyRowsProps) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{label}</h2>
        <span className="text-sm font-semibold text-slate-600">{taka(expense)} total</span>
      </div>
      <div className="mt-4">
        <MoneyRows {...rows} />
      </div>
    </Card>
  );
}

function BreakdownBars({ byType, total }: { byType: Record<string, number>; total: number }) {
  const rows = Object.entries(byType)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) return null;

  return (
    <ul className="space-y-3">
      {rows.map(([type, amount]) => {
        const percent = total > 0 ? Math.round((amount / total) * 100) : 0;
        return (
          <li key={type}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{expenseTypeLabel(type)}</span>
              <span className="text-slate-600">
                {taka(amount)} <span className="text-xs text-slate-400">({percent}%)</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function GroupStatsPanel({ card }: { card: GroupCard }) {
  const hasBreakdown = Object.values(card.byType).some((amount) => amount > 0);

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Meal rate</h4>
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          <MiniStat label="This month" value={taka(card.mealRate)} />
          <MiniStat label="Highest day" value={taka(card.highestDayRate)} />
          <MiniStat label="Lowest day" value={taka(card.lowestDayRate)} />
        </div>
        <div className="mt-3">
          <MealRateChart days={card.days} />
        </div>
      </div>

      <MoneyRows
        bazar={card.bazar}
        bazarPaid={card.bazarPaid}
        bazarOutstanding={card.bazarOutstanding}
        bills={card.bills}
        billsCollected={card.billsCollected}
        billsOutstanding={card.billsOutstanding}
        rent={card.rent}
        additional={card.additional}
      />

      {hasBreakdown && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cost breakdown</h4>
          <div className="mt-2">
            <BreakdownBars byType={{ ...card.byType, BAZAR: card.bazar }} total={card.expense} />
          </div>
        </div>
      )}
    </div>
  );
}

function PagedList<T>({
  items,
  pageSize,
  keyOf,
  renderItem
}: {
  items: T[];
  pageSize: number;
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = items.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  return (
    <>
      <ul className="mt-4 divide-y divide-slate-100">
        {visible.map((item) => (
          <Fragment key={keyOf(item)}>{renderItem(item)}</Fragment>
        ))}
      </ul>
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="min-h-[2.25rem] rounded-full border border-slate-200 px-3.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {currentPage + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage === pageCount - 1}
            className="min-h-[2.25rem] rounded-full border border-slate-200 px-3.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

function MemberDashboard({ report, currentUserId }: { report: MemberReport; currentUserId?: string }) {
  const [showLastMonth, setShowLastMonth] = useState(false);

  if (!report.group || !report.current) {
    return (
      <div className="space-y-6">
        {report.pendingInvitations > 0 && <InvitationBanner count={report.pendingInvitations} />}
        <Panel>
          You&apos;re not in a group yet. Once a supervisor invites you and you accept, your meals, costs, and dues
          will show up here.
        </Panel>
      </div>
    );
  }

  const { current, previous, group } = report;
  const hadLastMonth = Boolean(previous && (previous.meals > 0 || previous.totalCost > 0));

  return (
    <div className="space-y-6">
      {report.pendingInvitations > 0 && <InvitationBanner count={report.pendingInvitations} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <Stat
            label={
              current.dailyRate
                ? current.dailyRate.isToday
                  ? strings.meals.rate.todayLabel
                  : strings.meals.rate.latestLabel(shortDate(current.dailyRate.date))
                : strings.meals.rate.todayLabel
            }
            value={current.dailyRate ? `${taka(current.dailyRate.rate)}` : '—'}
          />
          <Stat label={strings.meals.rate.monthLabel} value={taka(current.mealRate)} />
          <Stat label="Your meals" value={current.meals} />
          <Stat
            label={current.due < 0 ? 'Mess owes you' : 'You owe'}
            value={taka(Math.abs(current.due))}
            tone={current.due > 0.01 ? 'red' : 'green'}
          />
        </div>

        <QuickActions
          items={[
            {
              href: ROUTES.meals,
              label: dashboardStrings.actions.enterOwnMeals,
              hint: dashboardStrings.actions.enterOwnMealsHint,
              icon: 'bowl'
            },
            {
              href: ROUTES.expenses,
              label: dashboardStrings.actions.logBazar,
              hint: dashboardStrings.actions.logBazarOwnHint,
              icon: 'cart'
            },
            {
              href: ROUTES.payments,
              label: dashboardStrings.actions.ownPayments,
              hint: dashboardStrings.actions.ownPaymentsHint,
              icon: 'cash'
            },
            {
              href: commentsAnchorPath(),
              label: dashboardStrings.actions.messComments,
              hint: dashboardStrings.actions.messCommentsHint,
              icon: 'chat'
            }
          ]}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Your balance</h2>
          <StatusBadge status={current.status} />
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Meal share (bazar)" value={taka(current.mealCost)} />
          <Field label="Bills share" value={taka(current.billShare)} />
          <Field label="Total cost" value={taka(current.totalCost)} />
          <Field label="Groceries you bought" value={taka(current.bazarPaid)} />
          <Field label="Cash you paid" value={taka(current.collected)} />
          <Field
            label={current.due < 0 ? 'Refund owed to you' : 'Still due'}
            value={taka(Math.abs(current.due))}
            tone={current.due > 0.01 ? 'red' : 'green'}
          />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <LinkButton href={ROUTES.meals}>Enter meals</LinkButton>
          <LinkButton href={ROUTES.payments} variant="secondary">
            Payments
          </LinkButton>
        </div>
      </Card>

      {hadLastMonth && previous && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setShowLastMonth((current) => !current)}
            aria-expanded={showLastMonth}
            className="flex w-full items-center justify-between gap-3 p-5 text-left sm:p-6"
          >
            <h2 className="text-lg font-semibold">Last month ({monthLabel(previous.month)})</h2>
            <Chevron open={showLastMonth} />
          </button>
          {showLastMonth && (
            <dl className="grid gap-4 border-t border-slate-100 px-5 pb-5 pt-4 sm:grid-cols-4 sm:px-6 sm:pb-6">
              <Field label="Meals" value={String(previous.meals)} />
              <Field label="Meal rate" value={taka(previous.mealRate)} />
              <Field label="Your cost" value={taka(previous.totalCost)} />
              <Field
                label={previous.due < 0 ? 'Refund' : 'Due'}
                value={taka(Math.abs(previous.due))}
                tone={previous.due > 0.01 ? 'red' : undefined}
              />
            </dl>
          )}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{group.name}</h2>
          <ActionLink href={groupPath(group.id)}>Group page</ActionLink>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {group.memberCount} member{group.memberCount === 1 ? '' : 's'} · here {formatStay(group.stayDays)}
        </p>

        <div className="mt-5">
          <GroupStatsPanel card={group.card} />
        </div>

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Everyone this month</h3>
        <PagedList
          items={current.members}
          pageSize={8}
          keyOf={(m) => m.id}
          renderItem={(m) => (
            <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.name}
                  {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600">(you)</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {m.meals} meal{m.meals === 1 ? '' : 's'} · {taka(m.totalCost)}
                </p>
              </div>
              <span className={`shrink-0 font-semibold ${m.due > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                {taka(Math.abs(m.due))}
              </span>
            </li>
          )}
        />
      </Card>
    </div>
  );
}

type QuickActionIcon = 'cart' | 'bowl' | 'cash' | 'user' | 'chat';

const QUICK_ACTION_ICONS: Record<QuickActionIcon, ReactNode> = {
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h3l2.4 12.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L21 7H6" />
    </>
  ),
  bowl: (
    <>
      <path d="M3 11h18" />
      <path d="M5 11a7 7 0 0 1 14 0" />
      <path d="M4 15h16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
    </>
  ),
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="11.5" cy="7" r="4" />
    </>
  ),
  chat: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" />
    </>
  )
};

function QuickActions({
  items
}: {
  items: { href: string; label: string; hint: string; icon: QuickActionIcon }[];
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">{dashboardStrings.quickActions}</h2>
      <p className="mt-1 text-sm text-slate-500">{dashboardStrings.quickActionsHint}</p>

      <ul className="mt-4 space-y-1.5">
        {items.map((item) => (
          <li key={item.href + item.label}>
            <Link
              href={item.href}
              className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {QUICK_ACTION_ICONS[item.icon]}
                </svg>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{item.label}</span>
                <span className="block truncate text-xs text-slate-500">{item.hint}</span>
              </span>

              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CostBreakdown({ byType, total }: { byType: Record<string, number>; total: number }) {
  const rows = Object.entries(byType)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) return null;

  return (
    <Card>
      <h2 className="text-lg font-semibold">Where the money went</h2>
      <ul className="mt-4 space-y-3">
        {rows.map(([type, amount]) => {
          const percent = total > 0 ? Math.round((amount / total) * 100) : 0;
          return (
            <li key={type}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{expenseTypeLabel(type)}</span>
                <span className="text-slate-600">
                  {taka(amount)} <span className="text-xs text-slate-400">({percent}%)</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function InvitationBanner({ count }: { count: number }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <p className="text-amber-800">
        You have {count} pending invitation{count === 1 ? '' : 's'}.
      </p>
      <LinkButton href={ROUTES.invitations} size="sm" className="mt-3">
        View invitations
      </LinkButton>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'PAID'
      ? 'bg-green-100 text-green-700'
      : status === 'PARTIAL'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700';
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{status.toLowerCase()}</span>;
}

function formatStay(days: number) {
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} year${years === 1 ? '' : 's'}` : `${years}y ${rest}m`;
}

function shortDate(day: string) {
  return formatDayKey(day, 'dayMonth');
}

function monthLabel(key: string) {
  return formatMonthLabel(key);
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">{children}</div>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{children}</div>;
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'green' | 'red' | 'amber' }) {
  const color =
    tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : '';
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="text-sm uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-3 text-2xl font-semibold sm:text-3xl ${color}`}>{value}</div>
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : '';
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-base font-semibold ${color}`}>{value}</dd>
    </div>
  );
}
