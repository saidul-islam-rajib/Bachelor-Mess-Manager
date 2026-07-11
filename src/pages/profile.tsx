import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';

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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">Profile</h1>
          <p className="mt-1 text-slate-600">Update your personal details.</p>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">Loading...</div>
        ) : !user ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm text-amber-800">
            Please sign in to view your profile.
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">{user.email}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{user.role}</span>
            </div>
            <form className="space-y-5" onSubmit={handleSubmit}>
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
        )}
      </section>
    </main>
  );
}
