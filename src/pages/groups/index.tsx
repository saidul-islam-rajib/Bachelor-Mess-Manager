import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

export default function GroupsPage() {
  const toast = useToast();
  const { user } = useCurrentUser();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const canCreate = user?.role === USER_ROLES.SUPERVISOR;

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/groups');
      if (!response.ok) throw new Error('Failed to load groups.');
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">Groups</h1>
          <p className="mt-1 text-slate-600">The messes you supervise or belong to.</p>
        </div>

        {canCreate && (
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Create a group</h2>
            <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={createGroup}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
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
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">Loading groups...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm text-red-700">{error}</div>
        ) : groups.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">
            No groups yet.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold sm:text-xl">{group.name}</h2>
                    <p className="text-sm text-slate-500">
                      Supervisor: {group.supervisor.name} ({group.supervisor.email})
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">{group.status}</span>
                    <span>{group.memberCount} members</span>
                  </div>
                </div>
                <Link
                  href={`/groups/${group.id}`}
                  className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
                >
                  View group
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
