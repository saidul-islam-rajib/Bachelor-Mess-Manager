import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string | null;
  createdAt: string;
};

type GroupSummary = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  supervisor: { id: string; name: string; email: string };
};

type GroupMember = { id: string; user: { id: string; name: string; email: string } };

const TABS = [
  { key: 'registrations', label: 'Registrations' },
  { key: 'users', label: 'Users' },
  { key: 'groups', label: 'Groups' },
  { key: 'settings', label: 'Settings' }
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AdminPage() {
  const { user, loading } = useCurrentUser();
  const [tab, setTab] = useState<TabKey>('registrations');

  if (loading) {
    return <Shell><Card className="text-slate-600">Loading...</Card></Shell>;
  }

  if (user?.role !== USER_ROLES.ADMIN) {
    return (
      <Shell>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Only admins can access this page.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === item.key ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'registrations' && <RegistrationsPanel />}
      {tab === 'users' && <UsersPanel />}
      {tab === 'groups' && <GroupsPanel />}
      {tab === 'settings' && <SettingsPanel />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">Admin dashboard</h1>
          <p className="mt-1 text-slate-600">Approve registrations, manage users, and run groups.</p>
        </div>
        {children}
      </section>
    </main>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>{children}</div>;
}

function RegistrationsPanel() {
  const toast = useToast();
  const [pending, setPending] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users?status=PENDING');
      const data = await res.json();
      setPending(data.users || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(target: AdminUser, status: 'APPROVED' | 'REJECTED') {
    setBusyId(target.id);
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Update failed.');
      setPending((prev) => prev.filter((u) => u.id !== target.id));
      toast.success(`${target.name} was ${status === 'APPROVED' ? 'approved' : 'rejected'}.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Card className="text-slate-600">Loading...</Card>;
  if (pending.length === 0) return <Card className="text-slate-600">No pending registrations.</Card>;

  return (
    <div className="space-y-3">
      {pending.map((u) => (
        <Card key={u.id}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{u.name}</p>
              <p className="text-sm text-slate-500">{u.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => decide(u, 'APPROVED')}
                disabled={busyId === u.id}
                className="flex-1 rounded-full bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-500 disabled:opacity-50 sm:flex-none"
              >
                Approve
              </button>
              <button
                onClick={() => decide(u, 'REJECTED')}
                disabled={busyId === u.id}
                className="flex-1 rounded-full border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:flex-none"
              >
                Reject
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

const USER_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const;
type UserFilter = (typeof USER_FILTERS)[number];

function UsersPanel() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UserFilter>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; phone: string; role: string; status: string }>({
    name: '',
    phone: '',
    role: USER_ROLES.MEMBER,
    status: USER_STATUS.APPROVED
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(u: AdminUser) {
    setEditingId(u.id);
    setDraft({ name: u.name, phone: u.phone ?? '', role: u.role, status: u.status });
  }

  async function save(u: AdminUser) {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Update failed.');
      setUsers((prev) => prev.map((item) => (item.id === u.id ? { ...item, ...data.user } : item)));
      setEditingId(null);
      toast.success(`Updated ${data.user?.name ?? u.name}.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card className="text-slate-600">Loading...</Card>;

  const approvedMembers = users.filter((u) => u.status === 'APPROVED' && u.role === USER_ROLES.MEMBER).length;
  const visible = filter === 'ALL' ? users : users.filter((u) => u.status === filter);

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {USER_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  filter === f ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500">
            {approvedMembers} approved member{approvedMembers === 1 ? '' : 's'} · {users.length} total
          </p>
        </div>
      </Card>

      {visible.length === 0 && <Card className="text-slate-600">No users match this filter.</Card>}

      {visible.map((u) => {
        const isAdmin = u.role === USER_ROLES.ADMIN;
        const editing = editingId === u.id;
        return (
          <Card key={u.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold">{u.name}</p>
                <p className="truncate text-sm text-slate-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{u.role}</Badge>
                <Badge tone={u.status === 'APPROVED' ? 'green' : u.status === 'REJECTED' ? 'red' : 'amber'}>
                  {u.status}
                </Badge>
                {!isAdmin && !editing && (
                  <button
                    onClick={() => startEdit(u)}
                    className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {editing && (
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-slate-600">Name</span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Phone</span>
                  <input
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Role</span>
                  <select
                    value={draft.role}
                    onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
                  >
                    <option value={USER_ROLES.MEMBER}>MEMBER</option>
                    <option value={USER_ROLES.SUPERVISOR}>SUPERVISOR</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Status</span>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
                  >
                    <option value={USER_STATUS.PENDING}>PENDING</option>
                    <option value={USER_STATUS.APPROVED}>APPROVED</option>
                    <option value={USER_STATUS.REJECTED}>REJECTED</option>
                  </select>
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button
                    onClick={() => save(u)}
                    disabled={saving}
                    className="rounded-full bg-slate-900 px-5 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-full border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function GroupsPanel() {
  const toast = useToast();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      setGroups(data.groups || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, supervisorEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not create group.');
      toast.success(`Group "${name}" created.`);
      setName('');
      setSupervisorEmail('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold">Create a group</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={createGroup}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Group name"
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
          />
          <input
            value={supervisorEmail}
            onChange={(e) => setSupervisorEmail(e.target.value)}
            required
            type="email"
            placeholder="Supervisor email"
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-full bg-slate-900 px-6 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      </Card>

      {loading ? (
        <Card className="text-slate-600">Loading...</Card>
      ) : groups.length === 0 ? (
        <Card className="text-slate-600">No groups yet.</Card>
      ) : (
        groups.map((g) => (
          <Card key={g.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{g.name}</p>
                <p className="text-sm text-slate-500">
                  Supervisor: {g.supervisor.name} ({g.supervisor.email}) · {g.memberCount} members
                </p>
              </div>
              <button
                onClick={() => setOpenId(openId === g.id ? null : g.id)}
                className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                {openId === g.id ? 'Close' : 'Manage members'}
              </button>
            </div>
            {openId === g.id && <GroupMembersEditor groupId={g.id} onChanged={load} />}
          </Card>
        ))
      )}
    </div>
  );
}

function GroupMembersEditor({ groupId, onChanged }: { groupId: string; onChanged: () => void }) {
  const toast = useToast();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [supervisorId, setSupervisorId] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    const data = await res.json();
    setMembers(data.group?.memberships ?? []);
    setSupervisorId(data.group?.supervisor?.id ?? '');
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not add member.');
      toast.success(`${data.member?.name ?? email} added.`);
      setEmail('');
      await load();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string, memberName: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not remove member.');
      toast.success(`${memberName} removed.`);
      await load();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={add}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          placeholder="Add approved user by email"
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      <ul className="mt-3 divide-y divide-slate-100">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0 truncate">
              {m.user.name} <span className="text-slate-400">({m.user.email})</span>
            </span>
            {m.user.id === supervisorId ? (
              <span className="shrink-0 text-xs uppercase text-slate-400">Supervisor</span>
            ) : (
              <button
                onClick={() => remove(m.user.id, m.user.name)}
                disabled={busy}
                className="shrink-0 rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

type SiteSettings = {
  companyName: string;
  tagline: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  copyrightOwner: string;
  facebookUrl: string;
  twitterUrl: string;
  newsletterEnabled: boolean;
};

const SETTINGS_FIELDS: { key: keyof SiteSettings; label: string }[] = [
  { key: 'companyName', label: 'Company name' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'copyrightOwner', label: 'Copyright owner' },
  { key: 'address', label: 'Address' },
  { key: 'contactEmail', label: 'Contact email' },
  { key: 'contactPhone', label: 'Contact phone' },
  { key: 'facebookUrl', label: 'Facebook URL' },
  { key: 'twitterUrl', label: 'Twitter / X URL' }
];

function SettingsPanel() {
  const toast = useToast();
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        const s = data.settings ?? {};
        setForm({
          companyName: s.companyName ?? '',
          tagline: s.tagline ?? '',
          address: s.address ?? '',
          contactEmail: s.contactEmail ?? '',
          contactPhone: s.contactPhone ?? '',
          copyrightOwner: s.copyrightOwner ?? '',
          facebookUrl: s.facebookUrl ?? '',
          twitterUrl: s.twitterUrl ?? '',
          newsletterEnabled: s.newsletterEnabled ?? true
        });
      })
      .catch(() => setForm(null));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not save settings.');
      toast.success('Website settings saved.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <Card className="text-slate-600">Loading...</Card>;

  return (
    <Card>
      <h2 className="text-lg font-semibold">Website settings</h2>
      <p className="mt-1 text-sm text-slate-500">These values appear in the site footer.</p>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={save}>
        {SETTINGS_FIELDS.map((field) => (
          <label key={field.key} className="text-sm">
            <span className="text-slate-600">{field.label}</span>
            <input
              value={form[field.key] as string}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, [field.key]: e.target.value } : prev))}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.newsletterEnabled}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, newsletterEnabled: e.target.checked } : prev))}
            className="h-4 w-4"
          />
          <span className="text-slate-700">Show newsletter signup in footer</span>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700'
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
