import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { strings } from '@/lib/i18n';

const copy = strings.monthSummary;
const taka = formatCurrency;

type SummaryMember = {
  id: string;
  billShare: number;
  billPaid: number;
  billOutstanding: number;
  totalCost: number;
  bazarPaid: number;
  collected: number;
  due: number;
};

type SummaryData = {
  currentUserId: string;
  group: {
    bazar: number;
    bazarOutstanding: number;
    bills: number;
    rent: number;
    additional: number;
  };
  members: SummaryMember[];
};

function Row({ label, value, tone = '', hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-900/60">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone || 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">{children}</div>
    </div>
  );
}

export default function MessMonthSummary({ groupId, month }: { groupId: string; month: string }) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<SummaryData>(`/api/groups/${groupId}/bazar-summary`, { query: { month } });
      setData(result);
    } catch (err) {
      setError(errorMessage(err, copy.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [groupId, month]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{strings.common.loading}</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{error || copy.loadFailed}</p>;
  }

  const me = data.members.find((member) => member.id === data.currentUserId);
  const paid = me ? me.bazarPaid + me.collected : 0;

  return (
    <div className="space-y-4">
      <Group title={copy.messSection}>
        <Row label={copy.mealCost} value={taka(data.group.bazar)} />
        <Row
          label={copy.yetToRecover}
          value={taka(data.group.bazarOutstanding)}
          tone={data.group.bazarOutstanding > 0.01 ? 'text-amber-700 dark:text-amber-400' : ''}
        />
        <Row label={copy.additionalBills} value={taka(data.group.additional)} />
        <Row label={copy.totalBills} value={taka(data.group.bills)} />
      </Group>

      {me ? (
        <>
          <Group title={copy.billsSection}>
            <Row label={copy.myBillShare} value={taka(me.billShare)} />
            <Row label={copy.myBillPaid} value={taka(me.billPaid)} />
            <Row
              label={copy.myBillDue}
              value={taka(me.billOutstanding)}
              tone={me.billOutstanding > 0.01 ? 'text-rose-600' : ''}
            />
          </Group>

          <Group title={copy.totalSection}>
            <Row label={copy.payable} value={taka(me.totalCost)} />
            <Row label={copy.paid} value={taka(paid)} hint={copy.paidHint} />
            <Row
              label={me.due > 0.01 ? copy.due : me.due < -0.01 ? copy.refund : copy.settled}
              value={me.due > 0.01 || me.due < -0.01 ? taka(Math.abs(me.due)) : strings.common.dash}
              tone={me.due > 0.01 ? 'text-rose-600' : me.due < -0.01 ? 'text-teal-700 dark:text-teal-400' : ''}
            />
          </Group>
        </>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{copy.noData}</p>
      )}
    </div>
  );
}
