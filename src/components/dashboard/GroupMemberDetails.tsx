import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui';
import { Figure } from '@/components/bills/MemberTable';
import { api, errorMessage } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { memberDetailPath } from '@/lib/routes';

const taka = formatCurrency;
const memberDetails = strings.dashboard.memberDetails;

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
  billPaid: number;
  due: number;
  status: string;
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
  return strings.common.dash;
}

function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-slate-300 dark:text-slate-600"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MemberRow({
  member,
  groupId,
  month,
  isCurrentUser
}: {
  member: SummaryMember;
  groupId: string;
  month: string;
  isCurrentUser: boolean;
}) {
  return (
    <li className={member.isActive ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-900/40'}>
      <Link
        href={memberDetailPath(member.id, groupId, month)}
        aria-label={memberDetails.openMember(member.name)}
        className="block px-3.5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60 sm:px-4"
      >
        <span className="flex items-center gap-2.5">
          <Avatar name={member.name} size="sm" muted={!member.isActive} />
          <span className="min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-slate-100">
            {member.name}
            {isCurrentUser && <span className="ml-1.5 text-xs font-normal text-brand-700">{strings.common.you}</span>}
          </span>
          <Chevron />
        </span>

        <span className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
          <Figure label={memberDetails.meals} value={member.meals} />
          <Figure label={memberDetails.bazarPaid} value={taka(member.bazarPaid)} />
          <Figure label={memberDetails.billsPaid} value={taka(member.billPaid)} />
          <Figure
            strong
            label={member.due > 0 ? memberDetails.due : member.due < 0 ? memberDetails.refund : memberDetails.settledUp}
            value={dueLabel(member.due)}
            className={member.due > 0 ? 'text-rose-600' : member.due < 0 ? 'text-teal-700 dark:text-teal-400' : ''}
          />
        </span>
      </Link>
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
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
      {data.members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          groupId={groupId}
          month={month}
          isCurrentUser={member.id === data.currentUserId}
        />
      ))}
    </ul>
  );
}
