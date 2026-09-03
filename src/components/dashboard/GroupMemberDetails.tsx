import { useCallback, useEffect, useState } from 'react';
import { Chevron, Figure } from '@/components/bills/MemberTable';
import { api, errorMessage } from '@/lib/api-client';
import { formatCurrency, formatDayKey } from '@/lib/format';
import { strings } from '@/lib/i18n';

const taka = formatCurrency;
const memberDetails = strings.dashboard.memberDetails;

type BazarEntry = { id: string; date: string; amount: number };

type SummaryMember = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  meals: number;
  bazarPaid: number;
  billShare: number;
  billShareByType: Record<string, number>;
  totalCost: number;
  collected: number;
  due: number;
  status: string;
  bazarEntries: BazarEntry[];
};

type BazarSummaryData = {
  through: string;
  currentUserId: string;
  canManage: boolean;
  categoryLabels: Record<string, string>;
  members: SummaryMember[];
};

function dueLabel(due: number): string {
  if (due > 0) return taka(due);
  if (due < 0) return `+${taka(-due)}`;
  return '—';
}

function BazarEntryList({ entries }: { entries: BazarEntry[] }) {
  if (entries.length === 0) {
    return <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{memberDetails.noBazarEntries}</p>;
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
        >
          <span className="text-xs text-slate-600 dark:text-slate-400">{formatDayKey(entry.date, 'weekdayDayMonth')}</span>
          <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">{taka(entry.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function AdditionalBills({ member, categoryLabels }: { member: SummaryMember; categoryLabels: Record<string, string> }) {
  const entries = Object.entries(member.billShareByType).filter(([, amount]) => amount > 0);

  if (entries.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">{memberDetails.noAdditionalBills}</p>;
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {entries.map(([type, amount]) => (
        <li
          key={type}
          className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300"
        >
          {categoryLabels[type] ?? type}: <span className="font-medium">{taka(amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function MemberRow({
  member,
  categoryLabels,
  isCurrentUser
}: {
  member: SummaryMember;
  categoryLabels: Record<string, string>;
  isCurrentUser: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showEntries, setShowEntries] = useState(false);

  return (
    <li className={member.isActive ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-900/40'}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="w-full px-3.5 py-3 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/70 sm:px-4"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="block min-w-0">
            <span className="block truncate font-semibold text-slate-900 dark:text-slate-100">
              {member.name}
              {isCurrentUser && <span className="ml-1.5 text-xs font-normal text-brand-700">{strings.common.you}</span>}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Chevron open={open} />
          </span>
        </span>

        <span className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 px-3 py-2 sm:grid-cols-4 sm:bg-transparent sm:px-0 sm:py-0">
          <Figure label={memberDetails.meals} value={member.meals} />
          <Figure label={memberDetails.bazarPaid} value={taka(member.bazarPaid)} />
          <Figure label={memberDetails.billsPaid} value={taka(member.collected)} />
          <Figure
            strong
            label={member.due > 0 ? memberDetails.due : member.due < 0 ? memberDetails.refund : memberDetails.settledUp}
            value={dueLabel(member.due)}
            className={member.due > 0 ? 'text-rose-600' : member.due < 0 ? 'text-teal-700 dark:text-teal-400' : ''}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 px-3.5 py-3 sm:px-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Figure label={memberDetails.totalCost} value={taka(member.totalCost)} />
            <Figure label={strings.bills.colShare} value={taka(member.billShare)} />
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {memberDetails.additionalBills}
            </p>
            <div className="mt-1.5">
              <AdditionalBills member={member} categoryLabels={categoryLabels} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowEntries((current) => !current)}
            aria-expanded={showEntries}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {showEntries ? memberDetails.hideBazarEntries : memberDetails.viewBazarEntries}
            <Chevron open={showEntries} />
          </button>

          {showEntries && <BazarEntryList entries={member.bazarEntries} />}
        </div>
      )}
    </li>
  );
}

export default function GroupMemberDetails({ groupId, month }: { groupId: string; month: string }) {
  const [data, setData] = useState<BazarSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<BazarSummaryData>(`/api/groups/${groupId}/bazar-summary`, { query: { month } });
      setData(result);
    } catch (err) {
      setError(errorMessage(err, memberDetails.loadFailed));
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
    return <p className="text-sm text-slate-500 dark:text-slate-400">{error || memberDetails.loadFailed}</p>;
  }

  if (data.members.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{memberDetails.empty}</p>;
  }

  return (
    <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      {data.members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          categoryLabels={data.categoryLabels}
          isCurrentUser={member.id === data.currentUserId}
        />
      ))}
    </ul>
  );
}
