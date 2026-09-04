import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { cacheConfig } from '@/config';
import { Listbox } from '@/components/ui';
import { useSelectedMonth } from '@/components/MonthProvider';
import { cached, invalidate } from '@/lib/cache';
import { strings } from '@/lib/i18n';
import { monthOptions } from '@/lib/month';

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
  const { month, setMonth } = useSelectedMonth();
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
      <Listbox
        className="min-w-0 flex-1"
        label={strings.common.group}
        value={groupId}
        onChange={setGroupId}
        placeholder={strings.groups.noGroups}
        options={groups.map((group) => ({ value: group.id, label: group.name }))}
      />
      <Listbox
        className="min-w-0 flex-1"
        label={strings.common.month}
        value={month}
        onChange={setMonth}
        options={options.map((option) => ({ value: option.key, label: option.label }))}
      />
    </div>
  );
}
