import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { useInvitations } from '@/components/InvitationsProvider';
import InvitationCard from '@/components/InvitationCard';

export default function ProfilePage() {
  const toast = useToast();
  const { user, loading, refresh } = useCurrentUser();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone ?? '');
    }
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const body: { name: string; phone: string; password?: string } = { name, phone };
      if (password) body.password = password;
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not update profile.');
      toast.success('Profile updated.');
      setPassword('');
      if (data.user?.phone !== undefined) setPhone(data.user.phone ?? '');
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Profile</h1>
        <p className="mt-1 text-slate-600">Your details and anything waiting for you.</p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">Loading...</div>
      ) : !user ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
          Please sign in to view your profile.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold">Your details</h2>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">{user.email}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{user.role}</span>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Phone</label>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Optional"
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">New password</label>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="Leave blank to keep current"
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-full bg-slate-900 px-6 py-3 text-white hover:bg-slate-700 disabled:opacity-50 sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </div>

          <InvitationsSection />
        </div>
      )}
    </section>
  );
}

function InvitationsSection() {
  const { invitations, count, loading } = useInvitations();
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched && count > 0) setOpen(true);
  }, [count, touched]);

  function toggle() {
    setTouched(true);
    setOpen((v) => !v);
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">Invitations</span>
              {count > 0 && (
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-inset ring-red-600/20">
                  {count} pending
                </span>
              )}
            </span>
            <span className="mt-1 block text-sm font-normal text-slate-500">
              Messes that have invited you to join.
            </span>
          </span>
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-lg leading-none text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {open ? '−' : '+'}
          </span>
        </button>
      </h2>

      {open && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : count === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-600">No pending invitations</p>
              <p className="mt-1 text-xs text-slate-400">
                When a supervisor invites you to a mess, it shows up here and in the bell at the top.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <InvitationCard invitation={invitation} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
