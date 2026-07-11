import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { USER_ROLES } from '@/lib/constants';

type Member = { id: string; name: string; email: string };
type GroupDetail = {
  id: string;
  name: string;
  status: string;
  supervisor: { id: string; name: string; email: string };
  memberships: { id: string; user: Member }[];
  mealWeightBreakfast: number;
  mealWeightLunch: number;
  mealWeightDinner: number;
};
type SentInvitation = {
  id: string;
  status: string;
  invitee: { id: string; name: string; email: string };
};

export default function GroupPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useCurrentUser();
  const groupId = Array.isArray(router.query.groupId) ? router.query.groupId[0] : router.query.groupId;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [invitations, setInvitations] = useState<SentInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);

  const canManage = useMemo(
    () => !!group && !!user && (user.role === USER_ROLES.ADMIN || user.id === group.supervisor.id),
    [group, user]
  );

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) throw new Error('Failed to load group.');
      const data = await res.json();
      setGroup(data.group);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadInvitations = useCallback(async () => {
    if (!groupId) return;
    const res = await fetch(`/api/groups/${groupId}/invitations`);
    if (res.ok) {
      const data = await res.json();
      setInvitations(data.invitations || []);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    if (canManage) loadInvitations();
  }, [canManage, loadInvitations]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not send invitation.');
      toast.success(`Invitation sent to ${data.invitee?.name ?? email}.`);
      setEmail('');
      await loadInvitations();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function cancelInvite(inv: SentInvitation) {
    setBusy(true);
    try {
      const res = await fetch(`/api/invitations/${inv.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not cancel invitation.');
      toast.success(`Invitation to ${inv.invitee.name} cancelled.`);
      await loadInvitations();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member: Member) {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not remove member.');
      toast.success(`${member.name} removed.`);
      await loadGroup();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pendingInvites = invitations.filter((inv) => inv.status === 'PENDING');

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">Loading group...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm text-red-700">{error}</div>
        ) : group ? (
          <>
            <div className="mb-6 flex flex-col gap-2">
              <h1 className="text-2xl font-semibold sm:text-3xl">{group.name}</h1>
              <p className="text-slate-600">
                Supervisor: {group.supervisor.name} ({group.supervisor.email})
              </p>
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{group.status}</span>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold sm:text-xl">Members ({group.memberships.length})</h2>
              <ul className="mt-4 divide-y divide-slate-100">
                {group.memberships.length === 0 ? (
                  <li className="py-3 text-slate-500">No members yet.</li>
                ) : (
                  group.memberships.map((membership) => {
                    const isSupervisor = membership.user.id === group.supervisor.id;
                    return (
                      <li key={membership.id} className="flex items-center justify-between gap-2 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{membership.user.name}</p>
                          <p className="truncate text-sm text-slate-500">{membership.user.email}</p>
                        </div>
                        {isSupervisor ? (
                          <span className="shrink-0 text-xs uppercase tracking-wide text-slate-400">Supervisor</span>
                        ) : canManage ? (
                          <button
                            onClick={() => removeMember(membership.user)}
                            disabled={busy}
                            className="shrink-0 rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {canManage && (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-semibold sm:text-xl">Invite a member</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the email of an approved user. They&apos;ll get an invitation to accept.
                </p>
                <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={invite}>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    placeholder="member@example.com"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
                  />
                  <button
                    type="submit"
                    disabled={inviting}
                    className="rounded-full bg-slate-900 px-6 py-3 text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {inviting ? 'Sending...' : 'Invite'}
                  </button>
                </form>

                {pendingInvites.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-semibold text-slate-600">Pending invitations</h3>
                    <ul className="mt-2 divide-y divide-slate-100">
                      {pendingInvites.map((inv) => (
                        <li key={inv.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                          <span className="min-w-0 truncate">
                            {inv.invitee.name} <span className="text-slate-400">({inv.invitee.email})</span>
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">Pending</span>
                            <button
                              onClick={() => cancelInvite(inv)}
                              disabled={busy}
                              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {canManage && (
              <MealWeightsCard
                groupId={group.id}
                initial={{
                  breakfast: group.mealWeightBreakfast,
                  lunch: group.mealWeightLunch,
                  dinner: group.mealWeightDinner
                }}
                onSaved={loadGroup}
              />
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">Group not found.</div>
        )}
      </section>
    </main>
  );
}

function MealWeightsCard({
  groupId,
  initial,
  onSaved
}: {
  groupId: string;
  initial: { breakfast: number; lunch: number; dinner: number };
  onSaved: () => void;
}) {
  const toast = useToast();
  const [breakfast, setBreakfast] = useState(String(initial.breakfast));
  const [lunch, setLunch] = useState(String(initial.lunch));
  const [dinner, setDinner] = useState(String(initial.dinner));
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealWeightBreakfast: Number(breakfast),
          mealWeightLunch: Number(lunch),
          mealWeightDinner: Number(dinner)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not save meal weights.');
      toast.success('Meal weights updated.');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold sm:text-xl">Meal weights</h2>
      <p className="mt-1 text-sm text-slate-500">
        How much each meal counts toward the cost split (e.g. breakfast 0.5, lunch 1, dinner 1).
      </p>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={save}>
        {[
          { label: 'Breakfast', value: breakfast, set: setBreakfast },
          { label: 'Lunch', value: lunch, set: setLunch },
          { label: 'Dinner', value: dinner, set: setDinner }
        ].map((f) => (
          <label key={f.label} className="text-sm">
            <span className="text-slate-600">{f.label}</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={saving}
          className="self-end rounded-full bg-slate-900 px-6 py-2.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
}
