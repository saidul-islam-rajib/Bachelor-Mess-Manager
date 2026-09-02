import { useCallback, useEffect, useMemo, useState } from 'react';
import { MemberBillsTable } from '@/components/dashboard/MemberBillsTable';
import { ActionLink } from '@/components/ui';
import { api, errorMessage } from '@/lib/api-client';
import { sortByPosition, summarizeMembers, type BillsData } from '@/lib/bill-view';
import { ROUTES } from '@/lib/routes';
import { strings } from '@/lib/i18n';

export default function GroupBillsSummary({ groupId, month }: { groupId: string; month: string }) {
  const [data, setData] = useState<BillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<BillsData>(`/api/groups/${groupId}/bills`, { query: { month } });
      setData(result);
    } catch (err) {
      setError(errorMessage(err));
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
    return <p className="text-sm text-slate-500 dark:text-slate-400">{error || strings.errors.generic}</p>;
  }

  if (data.bills.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{strings.bills.finalSummary.noShares}</p>;
  }

  return (
    <div>
      <MemberBillsTableSection bills={data.bills} currentUserId={data.currentUserId} />
      <ActionLink href={ROUTES.bills} className="mt-3">
        {strings.dashboard.openBills}
      </ActionLink>
    </div>
  );
}

function MemberBillsTableSection({ bills, currentUserId }: { bills: BillsData['bills']; currentUserId: string }) {
  const summaries = useMemo(() => sortByPosition(summarizeMembers(bills, currentUserId)), [bills, currentUserId]);
  return <MemberBillsTable summaries={summaries} />;
}
