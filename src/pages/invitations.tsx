import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';

type Invitation = {
  id: string;
  createdAt: string;
  group: { id: string; name: string };
  inviter: { id: string; name: string; email: string };
};

export default function InvitationsPage() {
  const toast = useToast();
  const { refresh: refreshUser } = useCurrentUser();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/invitations');
      const data = await res.json();
      setInvitations(data.invitations || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(inv: Invitation, status: 'ACCEPTED' | 'REJECTED') {
    setBusyId(inv.id);
    try {
      const res = await fetch(`/api/invitations/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not update invitation.');
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      toast.success(
        status === 'ACCEPTED' ? `You joined "${inv.group.name}".` : `Invitation to "${inv.group.name}" declined.`
      );
      refreshUser();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">Invitations</h1>
          <p className="mt-1 text-slate-600">Groups (messes) that have invited you to join.</p>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">Loading...</div>
        ) : invitations.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">
            You have no pending invitations.
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{inv.group.name}</p>
                    <p className="text-sm text-slate-500">Invited by {inv.inviter.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond(inv, 'ACCEPTED')}
                      disabled={busyId === inv.id}
                      className="flex-1 rounded-full bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-500 disabled:opacity-50 sm:flex-none"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respond(inv, 'REJECTED')}
                      disabled={busyId === inv.id}
                      className="flex-1 rounded-full border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:flex-none"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
