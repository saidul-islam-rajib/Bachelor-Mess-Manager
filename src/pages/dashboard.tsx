import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { ROUTES } from '@/lib/routes';
import { USER_ROLES } from '@/lib/constants';

type AdminUser = { id: string; role: string; status: string };
type GroupSummary = { id: string; name: string; memberCount: number; supervisor: { id: string; name: string } };

export default function DashboardPage() {
  const { user, loading } = useCurrentUser();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-slate-600">
            {user ? `Signed in as ${user.name} (${user.role})` : 'Your mess at a glance.'}
          </p>
        </div>

        {loading ? (
          <Panel>Loading...</Panel>
        ) : !user ? (
          <Panel>Please sign in.</Panel>
        ) : user.role === USER_ROLES.ADMIN ? (
          <AdminDashboard />
        ) : user.role === USER_ROLES.SUPERVISOR ? (
          <SupervisorDashboard />
        ) : (
          <MemberDashboard />
        )}
      </section>
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">{children}</div>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="text-sm uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/groups').then((r) => r.json())
    ])
      .then(([u, g]) => {
        setUsers(u.users || []);
        setGroups(g.groups || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Panel>Loading...</Panel>;

  const pending = users.filter((u) => u.status === 'PENDING').length;
  const approvedMembers = users.filter((u) => u.status === 'APPROVED' && u.role === USER_ROLES.MEMBER).length;
  const supervisors = users.filter((u) => u.role === USER_ROLES.SUPERVISOR).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pending approvals" value={pending} />
        <Stat label="Approved members" value={approvedMembers} />
        <Stat label="Supervisors" value={supervisors} />
        <Stat label="Groups" value={groups.length} />
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Admin tools</h2>
        <p className="mt-1 text-sm text-slate-500">Approve registrations, manage users and groups, and edit site settings.</p>
        <Link
          href={ROUTES.admin}
          className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm text-white hover:bg-slate-700"
        >
          Open admin dashboard
        </Link>
      </div>
    </div>
  );
}

function SupervisorDashboard() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((d) => setGroups(d.groups || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Panel>Loading...</Panel>;

  const totalMembers = groups.reduce((sum, g) => sum + g.memberCount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Your groups" value={groups.length} />
        <Stat label="Total members" value={totalMembers} />
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your groups</h2>
          <Link href={ROUTES.groups} className="text-sm font-medium text-slate-900 hover:underline">
            Manage
          </Link>
        </div>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            You haven&apos;t created a group yet. Head to Groups to create your first mess.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-3">
                <Link href={`/groups/${g.id}`} className="font-medium hover:underline">
                  {g.name}
                </Link>
                <span className="text-sm text-slate-500">{g.memberCount} members</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MemberDashboard() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [inviteCount, setInviteCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/groups').then((r) => r.json()),
      fetch('/api/invitations').then((r) => r.json())
    ])
      .then(([g, i]) => {
        setGroups(g.groups || []);
        setInviteCount((i.invitations || []).length);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Panel>Loading...</Panel>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Your groups" value={groups.length} />
        <Stat label="Pending invitations" value={inviteCount} />
      </div>

      {inviteCount > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-amber-800">
            You have {inviteCount} pending invitation{inviteCount === 1 ? '' : 's'}.
          </p>
          <Link
            href={ROUTES.invitations}
            className="mt-3 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm text-white hover:bg-slate-700"
          >
            View invitations
          </Link>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Your groups</h2>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">You&apos;re not part of any group yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-3">
                <Link href={`/groups/${g.id}`} className="font-medium hover:underline">
                  {g.name}
                </Link>
                <span className="text-sm text-slate-500">Supervisor: {g.supervisor.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
