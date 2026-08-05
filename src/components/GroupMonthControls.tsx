import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { cacheConfig } from '@/config';
import { cached, invalidate } from '@/lib/cache';
import { strings } from '@/lib/i18n';
import { currentMonthKey, monthOptions } from '@/lib/month';

export type GroupOption = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  supervisor: { id: string; name: string; email: string };
};

export type GroupLimits = { maxGroups: number; ownedCount: number; canCreate: boolean };

export function useGroupMonth(options: { includeInactive?: boolean } = {}) {
  const includeInactive = options.includeInactive ?? false;
  const router = useRouter();
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupId, setGroupId] = useState('');
  const [month, setMonth] = useState(currentMonthKey());
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [limits, setLimits] = useState<GroupLimits | null>(null);
  const [hiddenInactive, setHiddenInactive] = useState(0);

  const requestedGroupId = typeof router.query.group === 'string' ? router.query.group : '';

  const reloadGroups = useCallback(async (options: { fresh?: boolean } = {}) => {
    setLoadingGroups(true);
    const path = `/api/groups${includeInactive ? '?includeInactive=true' : ''}`;

    try {
      if (options.fresh) invalidate(path);

      const data = await cached(path, cacheConfig.groupListMs, () =>
        fetch(path).then((res) => res.json().catch(() => ({})))
      );
      const list: GroupOption[] = data.groups || [];
      setGroups(list);
      setLimits(data.limits ?? null);
      setHiddenInactive(data.hiddenInactive ?? 0);
      setGroupId((prev) => (prev && list.some((group) => group.id === prev) ? prev : list[0]?.id ?? ''));
    } finally {
      setLoadingGroups(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    reloadGroups();
  }, [reloadGroups]);

  useEffect(() => {
    if (!requestedGroupId) return;
    if (!groups.some((group) => group.id === requestedGroupId)) return;
    setGroupId(requestedGroupId);
  }, [requestedGroupId, groups]);

  return { groups, groupId, setGroupId, month, setMonth, loadingGroups, limits, hiddenInactive, reloadGroups };
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
      <label className="min-w-0 flex-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{strings.common.group}</span>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="app-select mt-1"
        >
          {groups.length === 0 && <option value="">{strings.groups.noGroups}</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 flex-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{strings.common.month}</span>
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
