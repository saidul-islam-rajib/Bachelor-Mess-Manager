import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import type { GroupLimits, GroupOption } from '@/components/GroupMonthControls';
import { GROUP_STATUS } from '@/lib/constants';
import { strings } from '@/lib/i18n';

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function YourGroups({
  groups,
  limits,
  canCreate,
  selectedId,
  onSelect,
  onChanged
}: {
  groups: GroupOption[];
  limits: GroupLimits | null;
  canCreate: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const ordered = order
    ? (order.map((id) => groups.find((group) => group.id === id)).filter(Boolean) as GroupOption[])
    : groups;

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.groups.createFailed);
      toast.success(strings.groups.created(name));
      setName('');
      setOrder(null);
      await onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function reorder(from: number, to: number) {
    if (to < 0 || to >= ordered.length) return;

    const next = move(ordered, from, to);
    const ids = next.map((group) => group.id);
    setOrder(ids);
    setSaving(true);

    try {
      const res = await fetch('/api/groups/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: ids })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.groups.orderSaveFailed);
      await onChanged();
      setOrder(null);
    } catch (err) {
      setOrder(null);
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {canCreate && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{strings.groups.create}</h2>
            {limits && (
              <span className="text-sm text-slate-500">
                {strings.groups.limitUsed(limits.ownedCount, limits.maxGroups)}
              </span>
            )}
          </div>

          {limits && !limits.canCreate ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {strings.groups.limitReached(limits.maxGroups)}
            </p>
          ) : (
            <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={createGroup}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={80}
                placeholder={strings.groups.namePlaceholder}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              />
              <button
                type="submit"
                disabled={creating}
                className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-6 py-3 text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
              >
                {creating ? strings.common.creating : strings.common.create}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">{strings.groups.yourGroups}</h2>
        <p className="mt-1 text-sm text-slate-500">{strings.groups.yourGroupsHint}</p>

        {ordered.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{strings.groups.noGroups}</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {ordered.map((group, index) => (
              <li key={group.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <button
                  type="button"
                  onClick={() => onSelect(group.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${group.id === selectedId ? 'text-slate-900' : 'text-slate-700'}`}>
                      {group.name}
                    </span>
                    {group.status !== GROUP_STATUS.ACTIVE && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {strings.groups.inactive}
                      </span>
                    )}
                    {group.id === selectedId && (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">
                        {strings.common.selected}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {strings.members.supervisedBy(group.supervisor.name, group.supervisor.email)} ·{' '}
                    {strings.groups.memberCount(group.memberCount)}
                  </span>
                </button>

                {ordered.length > 1 && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => reorder(index, index - 1)}
                      disabled={saving || index === 0}
                      aria-label={strings.groups.moveUp}
                      title={strings.groups.moveUp}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19V5" />
                        <path d="M5 12l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => reorder(index, index + 1)}
                      disabled={saving || index === ordered.length - 1}
                      aria-label={strings.groups.moveDown}
                      title={strings.groups.moveDown}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14" />
                        <path d="M19 12l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
