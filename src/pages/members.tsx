import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { useGroupMonth } from '@/components/GroupMonthControls';

type Member = {
  membershipId: string;
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  isActive: boolean;
  isSupervisor: boolean;
  joinedAt: string;
  leftAt: string | null;
  stayDays: number;
};

type RosterData = { canManage: boolean; members: Member[] };

function formatStay(days: number) {
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} year${years === 1 ? '' : 's'}` : `${years}y ${rest}m`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MembersPage() {
  const { user } = useCurrentUser();
  const toast = useToast();
  const { groups, groupId, setGroupId, loadingGroups } = useGroupMonth();

  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not load members.');
      setData(body);
    } catch (err) {
      toast.error((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function setActive(member: Member, isActive: boolean) {
    setBusy(member.id);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, isActive })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not update the member.');
      toast.success(isActive ? `${member.name} is active again.` : `${member.name} marked as left.`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function leave() {
    const group = groups.find((g) => g.id === groupId);
    if (!window.confirm(`Leave "${group?.name ?? 'this group'}"? Your past meals and costs stay on record.`)) {
      return;
    }
    setBusy(user?.id ?? '');
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not leave the group.');
      toast.success('You have left the group.');
      // The group list itself changed, so reload rather than patching state.
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy('');
    }
  }

  const canManage = data?.canManage ?? false;
  const active = data?.members.filter((m) => m.isActive) ?? [];
  const past = data?.members.filter((m) => !m.isActive) ?? [];
  const me = data?.members.find((m) => m.id === user?.id && m.isActive);
  const canLeave = Boolean(me && !me.isSupervisor);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Members</h1>
        <p className="mt-1 text-slate-600">Who is in the mess now, who has left, and how long everyone has stayed.</p>
      </div>

      {loadingGroups ? (
        <Card>Loading...</Card>
      ) : groups.length === 0 ? (
        <Card>You&apos;re not part of any group yet.</Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Group</span>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="app-select mt-1">
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          {loading || !data ? (
            <Card>Loading members...</Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                <Stat label="Active members" value={String(active.length)} />
                <Stat label="Past members" value={String(past.length)} />
                <Stat
                  label="Longest stay"
                  value={active.length > 0 ? formatStay(Math.max(...active.map((m) => m.stayDays))) : '—'}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">Current members</h2>
                  {canLeave && (
                    <button
                      type="button"
                      onClick={leave}
                      disabled={busy === user?.id}
                      className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Leave this group
                    </button>
                  )}
                </div>

                <ul className="mt-4 divide-y divide-slate-100">
                  {active.map((member) => (
                    <li key={member.membershipId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar member={member} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {member.name}
                            {member.id === user?.id && <span className="ml-1 text-xs text-green-600">(you)</span>}
                            {member.isSupervisor && (
                              <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-normal text-white">
                                supervisor
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {member.email}
                            {member.phone && ` · ${member.phone}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatStay(member.stayDays)}</p>
                          <p className="text-xs text-slate-500">since {shortDate(member.joinedAt)}</p>
                        </div>
                        {canManage && !member.isSupervisor && (
                          <button
                            type="button"
                            onClick={() => setActive(member, false)}
                            disabled={busy === member.id}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {past.length > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-semibold">Past members</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Their meals and costs stay on record for the months they were here.
                  </p>
                  <ul className="mt-4 divide-y divide-slate-100">
                    {past.map((member) => (
                      <li key={member.membershipId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar member={member} muted />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-600">{member.name}</p>
                            <p className="truncate text-xs text-slate-500">
                              {member.leftAt ? `left ${shortDate(member.leftAt)}` : 'no longer active'} ·{' '}
                              {formatStay(member.stayDays)} stay
                            </p>
                          </div>
                        </div>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setActive(member, true)}
                            disabled={busy === member.id}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Add back
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Avatar({ member, muted = false }: { member: Member; muted?: boolean }) {
  if (member.profileImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={member.profileImage} alt="" className={`h-10 w-10 rounded-full object-cover ${muted ? 'opacity-60' : ''}`} />;
  }
  const initials = member.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
        muted ? 'bg-slate-100 text-slate-400' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {initials || '?'}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold sm:text-2xl">{value}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{children}</div>;
}
