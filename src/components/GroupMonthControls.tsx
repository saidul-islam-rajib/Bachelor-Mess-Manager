import { useEffect, useState } from 'react';
import { currentMonthKey, monthOptions } from '@/lib/month';

export type GroupOption = {
  id: string;
  name: string;
  supervisor: { id: string; name: string; email: string };
};

export function useGroupMonth() {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupId, setGroupId] = useState('');
  const [month, setMonth] = useState(currentMonthKey());
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((d) => {
        const gs: GroupOption[] = d.groups || [];
        setGroups(gs);
        setGroupId((prev) => prev || (gs[0]?.id ?? ''));
      })
      .finally(() => setLoadingGroups(false));
  }, []);

  return { groups, groupId, setGroupId, month, setMonth, loadingGroups };
}

export function GroupMonthControls({
  groups,
  groupId,
  setGroupId,
  month,
  setMonth
}: {
  groups: GroupOption[];
  groupId: string;
  setGroupId: (id: string) => void;
  month: string;
  setMonth: (m: string) => void;
}) {
  const options = monthOptions();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="flex-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Group</span>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="app-select mt-1"
        >
          {groups.length === 0 && <option value="">No groups</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Month</span>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="app-select mt-1"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
