import { timeAgo, useInvitations, type Invitation } from '@/components/InvitationsProvider';

export default function InvitationCard({ invitation, compact = false }: { invitation: Invitation; compact?: boolean }) {
  const { respond, busyId } = useInvitations();
  const busy = busyId === invitation.id;

  return (
    <div className={compact ? 'px-4 py-3' : 'rounded-2xl border border-slate-200 p-4'}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
          {invitation.group.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{invitation.inviter.name}</span> invited you to join{' '}
            <span className="font-semibold text-slate-900">{invitation.group.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{timeAgo(invitation.createdAt)}</p>

          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => respond(invitation, 'ACCEPTED')}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? '...' : 'Accept'}
            </button>
            <button
              onClick={() => respond(invitation, 'REJECTED')}
              disabled={busy}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
