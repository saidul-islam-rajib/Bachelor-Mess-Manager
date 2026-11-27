import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storage } from '@/core/storage';
import { fetchGroups, type GroupSummary } from '@/features/groups/api';
import { useAuth } from './auth';

const GROUP_KEY = 'group.active';

type GroupState = {
  groups: GroupSummary[];
  active: GroupSummary | null;
  loading: boolean;
  failed: boolean;
  select: (id: string) => void;
};

const GroupContext = createContext<GroupState | null>(null);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [savedId, setSavedId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['groups', user?.id], queryFn: fetchGroups, enabled: !!user });

  useEffect(() => {
    void storage.get(GROUP_KEY).then(setSavedId);
  }, []);

  const select = useCallback((id: string) => {
    setSavedId(id);
    void storage.set(GROUP_KEY, id);
  }, []);

  const groups = useMemo(() => query.data ?? [], [query.data]);
  const active = groups.find((g) => g.id === savedId) ?? groups[0] ?? null;

  const value = useMemo(
    () => ({ groups, active, loading: query.isLoading, failed: query.isError, select }),
    [groups, active, query.isLoading, query.isError, select],
  );
  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup(): GroupState {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroup outside GroupProvider');
  return ctx;
}
