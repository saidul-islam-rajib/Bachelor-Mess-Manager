import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, Card, PageTitle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api-client';
import { formatCurrency, formatDate, formatDayKey, formatMonthLabel, formatStayDuration } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { ROUTES } from '@/lib/routes';

const detail = strings.memberDetail;
const taka = formatCurrency;

type BazarItem = { id: string; name: string; amount: number };
type BazarEntry = { id: string; date: string; amount: number; note: string; items: BazarItem[] };
type MealDay = { date: string; breakfast: number; lunch: number; dinner: number; total: number };
type Payment = { id: string; date: string; amount: number; status: string; billType: string | null };
type DutyDay = { day: number; date: string | null };

type MemberDetailData = {
  monthKey: string;
  through: string;
  canManage: boolean;
  isSelf: boolean;
  group: { id: string; name: string };
  categoryLabels: Record<string, string>;
  member: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    profileImage: string | null;
    isActive: boolean;
    joinedAt: string;
    leftAt: string | null;
    stayDays: number;
    status: string;
  };
  money: {
    carryIn: number;
    mealCost: number;
    billShare: number;
    billShareByType: Record<string, number>;
    totalCost: number;
    bazarPaid: number;
    collected: number;
    due: number;
  };
  meals: { total: number; rate: number; days: MealDay[] };
  bazarEntries: BazarEntry[];
  dutyDays: DutyDay[];
  payments: Payment[];
};

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-900/60">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone || 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>;
}

function BazarEntryRow({ entry }: { entry: BazarEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
            {formatDayKey(entry.date, 'weekdayDayMonth')}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {entry.note || detail.itemCount(entry.items.length)}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {taka(entry.amount)}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900/60">
          {entry.items.length === 0 ? (
            <Empty text={detail.noItems} />
          ) : (
            <ul className="space-y-1.5">
              {entry.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">{taka(item.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export default function MemberDetailPage() {
  const router = useRouter();
  const { id, group, month } = router.query;
  const [data, setData] = useState<MemberDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const memberId = Array.isArray(id) ? id[0] : id;
  const groupId = Array.isArray(group) ? group[0] : group;
  const monthKey = Array.isArray(month) ? month[0] : month;

  const load = useCallback(async () => {
    if (!memberId || !groupId) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.get<MemberDetailData>(`/api/groups/${groupId}/members/${memberId}`, {
        query: { month: monthKey }
      });
      setData(result);
    } catch (err) {
      setError(errorMessage(err, detail.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [memberId, groupId, monthKey]);

  useEffect(() => {
    if (!router.isReady) return;
    load();
  }, [router.isReady, load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">{strings.common.loading}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Link href={ROUTES.dashboard} className="text-sm font-medium text-brand-700 hover:underline">
          ← {detail.back}
        </Link>
        <Empty text={error || detail.loadFailed} />
      </div>
    );
  }

  const { member, money, meals } = data;
  const billTypes = Object.entries(money.billShareByType).filter(([, amount]) => amount > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Link href={ROUTES.dashboard} className="inline-block text-sm font-medium text-brand-700 hover:underline">
        ← {detail.back}
      </Link>

      <Card>
        <div className="flex items-start gap-3">
          <Avatar name={member.name} image={member.profileImage} size="lg" muted={!member.isActive} />
          <div className="min-w-0 flex-1">
            <PageTitle title={member.name} />
            <h1 className="truncate text-xl font-semibold text-slate-900 dark:text-slate-100">{member.name}</h1>
            <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{member.email}</p>
            {member.phone && <p className="text-sm text-slate-500 dark:text-slate-400">{member.phone}</p>}
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {data.group.name} · {formatMonthLabel(data.monthKey)}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {member.leftAt ? detail.stayLeft(formatDate(member.leftAt)) : detail.staySince(formatDate(member.joinedAt))}
              {' · '}
              {formatStayDuration(member.stayDays)}
            </p>
          </div>
        </div>
      </Card>

      <Section title={detail.summary}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Stat label={detail.meals} value={String(meals.total)} />
          <Stat label={detail.mealCost} value={taka(money.mealCost)} />
          <Stat label={detail.bazarPaid} value={taka(money.bazarPaid)} />
          <Stat label={detail.billShare} value={taka(money.billShare)} />
          <Stat label={detail.paid} value={taka(money.collected)} />
          <Stat label={detail.totalCost} value={taka(money.totalCost)} />
          {money.carryIn !== 0 && <Stat label={detail.carryIn} value={taka(money.carryIn)} />}
          <Stat
            label={money.due > 0 ? detail.due : money.due < 0 ? detail.refund : detail.settled}
            value={money.due > 0 ? taka(money.due) : money.due < 0 ? `+${taka(-money.due)}` : strings.common.dash}
            tone={money.due > 0 ? 'text-rose-600' : money.due < 0 ? 'text-teal-700 dark:text-teal-400' : ''}
          />
        </div>
        {meals.rate > 0 && (
          <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">{detail.mealRateNote(taka(meals.rate))}</p>
        )}
      </Section>

      <Section title={detail.dutyTitle} subtitle={detail.dutySubtitle}>
        {data.dutyDays.length === 0 ? (
          <Empty text={detail.noDuty} />
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {data.dutyDays.map((duty) => (
              <li
                key={duty.day}
                className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 dark:bg-brand-500/15 dark:text-brand-200"
              >
                {duty.date ? formatDayKey(duty.date, 'dayMonth') : duty.day}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={detail.bazarTitle} subtitle={detail.bazarSubtitle}>
        {data.bazarEntries.length === 0 ? (
          <Empty text={detail.noBazar} />
        ) : (
          <>
            <ul className="space-y-2">
              {data.bazarEntries.map((entry) => (
                <BazarEntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
            <p className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-sm font-semibold dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400">{strings.common.total}</span>
              <span className="tabular-nums text-slate-900 dark:text-slate-100">{taka(money.bazarPaid)}</span>
            </p>
          </>
        )}
      </Section>

      <Section title={detail.billsTitle} subtitle={detail.billsSubtitle}>
        {billTypes.length === 0 ? (
          <Empty text={detail.noBills} />
        ) : (
          <>
            <ul className="space-y-1.5">
              {billTypes.map(([type, amount]) => (
                <li key={type} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">
                    {data.categoryLabels[type] ?? type}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">{taka(amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-sm font-semibold dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400">{strings.common.total}</span>
              <span className="tabular-nums text-slate-900 dark:text-slate-100">{taka(money.billShare)}</span>
            </p>
          </>
        )}
      </Section>

      <Section title={detail.mealsTitle} subtitle={detail.mealsSubtitle}>
        {meals.days.length === 0 ? (
          <Empty text={detail.noMeals} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {meals.days.map((day) => (
              <li key={day.date} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{formatDayKey(day.date, 'weekdayDayMonth')}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {detail.colBreakfast} {day.breakfast}
                  </span>
                  <span>
                    {detail.colLunch} {day.lunch}
                  </span>
                  <span>
                    {detail.colDinner} {day.dinner}
                  </span>
                  <span className="ml-1 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{day.total}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={detail.paymentsTitle} subtitle={detail.paymentsSubtitle}>
        {data.payments.length === 0 ? (
          <Empty text={detail.noPayments} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {data.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block text-slate-700 dark:text-slate-300">
                    {formatDayKey(payment.date, 'weekdayDayMonth')}
                  </span>
                  {payment.billType && (
                    <span className="block text-xs text-slate-400 dark:text-slate-500">
                      {data.categoryLabels[payment.billType] ?? payment.billType}
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {taka(payment.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
