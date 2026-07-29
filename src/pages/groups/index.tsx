import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { USER_ROLES } from '@/lib/constants';

type GroupSummary = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  supervisor: { id: string; name: string; email: string };
};

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function GroupsPage() {
  const toast = useToast();
  const { user } = useCurrentUser();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [limits, setLimits] = useState<{ maxGroups: number; ownedCount: number; canCreate: boolean } | null>(null);

  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const groupsRef = useRef<GroupSummary[]>([]);
  const savedOrder = useRef<string[]>([]);
  const prevRects = useRef<Map<string, number>>(new Map());
  const lastSwap = useRef(0);

  groupsRef.current = groups;

  useLayoutEffect(() => {
    const measured = new Map<string, number>();

    groups.forEach((group, index) => {
      const el = itemRefs.current[index];
      if (!el) return;

      el.style.transition = 'none';
      el.style.transform = '';
      const top = el.getBoundingClientRect().top;
      measured.set(group.id, top);

      const previous = prevRects.current.get(group.id);
      if (previous === undefined) return;

      const delta = previous - top;
      if (Math.abs(delta) < 1) return;

      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 220ms cubic-bezier(0.2, 0, 0, 1)';
        el.style.transform = 'translateY(0)';
      });
    });

    prevRects.current = measured;
  }, [groups]);

  const canCreate = user?.role === USER_ROLES.SUPERVISOR;
  const canReorder = groups.length > 1;

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/groups');
      if (!response.ok) throw new Error('Failed to load groups.');
      const data = await response.json();
      const list: GroupSummary[] = data.groups || [];
      setGroups(list);
      setLimits(data.limits ?? null);
      savedOrder.current = list.map((g) => g.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const persistOrder = useCallback(
    async (list: GroupSummary[]) => {
      const ids = list.map((g) => g.id);
      if (ids.join() === savedOrder.current.join()) return;

      const previous = savedOrder.current;
      savedOrder.current = ids;

      try {
        const res = await fetch('/api/groups/order', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupIds: ids })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? 'Could not save the new order.');
      } catch (err) {
        savedOrder.current = previous;
        toast.error((err as Error).message);
        loadGroups();
      }
    },
    [toast, loadGroups]
  );

  useEffect(() => {
    if (dragIndex === null) return;

    function onMove(event: PointerEvent) {
      const current = dragIndex as number;

      // Let a swap finish animating before allowing the next one, so cards
      // don't thrash while the pointer sits near a boundary.
      if (Date.now() - lastSwap.current < 200) return;

      let target = current;
      for (let i = 0; i < itemRefs.current.length; i += 1) {
        const rect = itemRefs.current[i]?.getBoundingClientRect();
        if (!rect) continue;
        if (event.clientY < rect.top + rect.height / 2) {
          target = i;
          break;
        }
        target = i;
      }

      if (target !== current) {
        lastSwap.current = Date.now();
        setGroups((prev) => move(prev, current, target));
        setDragIndex(target);
      }
    }

    function onEnd() {
      setDragIndex(null);
      persistOrder(groupsRef.current);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragIndex, persistOrder]);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not create group.');
      toast.success(`Group "${name}" created.`);
      setName('');
      await loadGroups();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Groups</h1>
        <p className="mt-1 text-slate-600">
          The messes you supervise or belong to.
          {canReorder && ' Drag a card to change the order.'}
        </p>
      </div>

      {canCreate && (
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Create a group</h2>
            {limits && (
              <span className="text-sm text-slate-500">
                {limits.ownedCount} of {limits.maxGroups} used
              </span>
            )}
          </div>

          {limits && !limits.canCreate ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You have reached the limit of {limits.maxGroups} groups. Close or hand over an existing group before
              creating another.
            </p>
          ) : (
            <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={createGroup}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={80}
                placeholder="Group (mess) name"
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              />
              <button
                type="submit"
                disabled={creating}
                className="rounded-full bg-slate-900 px-6 py-3 text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">Loading groups...</div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">{error}</div>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No groups yet.</div>
      ) : (
        <ul className="space-y-4">
          {groups.map((group, index) => {
            const dragging = dragIndex === index;

            return (
              <li
                key={group.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onPointerDown={(event) => {
                  if (!canReorder) return;
                  if (event.pointerType !== 'mouse') return;
                  const target = event.target as HTMLElement;
                  if (target.closest('a, button, input, textarea, select')) return;
                  event.preventDefault();
                  setDragIndex(index);
                }}
                style={dragging ? { zIndex: 10, position: 'relative' } : undefined}
                className={`rounded-3xl border bg-white p-5 shadow-sm sm:p-6 ${
                  canReorder ? 'cursor-grab select-none' : ''
                } ${
                  dragging
                    ? 'cursor-grabbing border-slate-900 shadow-xl ring-2 ring-slate-900/10'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {canReorder && (
                    <button
                      type="button"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setDragIndex(index);
                      }}
                      aria-label={`Reorder ${group.name}`}
                      title="Drag to reorder"
                      style={{ touchAction: 'none' }}
                      className={`mt-1 shrink-0 rounded-md p-1 transition-colors ${
                        dragging ? 'cursor-grabbing text-slate-700' : 'cursor-grab text-slate-300 hover:text-slate-500'
                      }`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="6" r="1.6" />
                        <circle cx="15" cy="6" r="1.6" />
                        <circle cx="9" cy="12" r="1.6" />
                        <circle cx="15" cy="12" r="1.6" />
                        <circle cx="9" cy="18" r="1.6" />
                        <circle cx="15" cy="18" r="1.6" />
                      </svg>
                    </button>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold sm:text-xl">{group.name}</h2>
                        <p className="text-sm text-slate-500">
                          Supervisor: {group.supervisor.name} ({group.supervisor.email})
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-sm text-slate-600">
                        <span className="rounded-full bg-slate-100 px-3 py-1">{group.status}</span>
                        <span>
                          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/groups/${group.id}`}
                      className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
                    >
                      View group
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
