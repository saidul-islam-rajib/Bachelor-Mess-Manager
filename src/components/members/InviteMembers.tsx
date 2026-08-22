import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { strings } from '@/lib/i18n';

type SentInvitation = {
  id: string;
  status: string;
  invitee: { id: string; name: string; email: string };
};

export default function InviteMembers({ groupId, onInvited }: { groupId: string; onInvited?: () => void }) {
  const toast = useToast();
  const [invitations, setInvitations] = useState<SentInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    const res = await fetch(`/api/groups/${groupId}/invitations`);
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    setInvitations(data.invitations || []);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

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
      if (!res.ok) throw new Error(data?.error ?? strings.members.inviteFailed);
      toast.success(strings.invitations.sent(data.invitee?.name ?? email));
      setEmail('');
      await load();
      onInvited?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function cancelInvite(invitation: SentInvitation) {
    setBusy(true);
    try {
      const res = await fetch(`/api/invitations/${invitation.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.members.cancelInviteFailed);
      toast.success(strings.invitations.cancelled);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pending = invitations.filter((invitation) => invitation.status === 'PENDING');

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">{strings.members.inviteTitle}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{strings.members.inviteHint}</p>

      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={invite}>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required
          placeholder={strings.invitations.inviteePlaceholder}
          className="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-3"
        />
        <button
          type="submit"
          disabled={inviting}
          className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-6 py-3 text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
        >
          {inviting ? strings.members.inviting : strings.members.invite}
        </button>
      </form>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">{strings.members.pendingInvites}</h3>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{strings.members.noPendingInvites}</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
            {pending.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {invitation.invitee.name} <span className="text-slate-400 dark:text-slate-500">({invitation.invitee.email})</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-amber-100 dark:bg-amber-500/15 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-400">
                    {strings.invitations.pending}
                  </span>
                  <button
                    type="button"
                    onClick={() => cancelInvite(invitation)}
                    disabled={busy}
                    className="rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                  >
                    {strings.common.cancel}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
