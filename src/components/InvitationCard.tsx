import { timeAgo, useInvitations, type Invitation } from '@/components/InvitationsProvider';
import { Avatar, Button } from '@/components/ui';
import { strings } from '@/lib/i18n';

export default function InvitationCard({ invitation, compact = false }: { invitation: Invitation; compact?: boolean }) {
  const { respond, busyId } = useInvitations();
  const busy = busyId === invitation.id;

  return (
    <div className={compact ? 'px-4 py-3 sm:px-5 sm:py-4' : 'rounded-2xl border border-slate-200 dark:border-slate-700 p-4'}>
      <div className="flex items-start gap-3">
        <Avatar name={invitation.group.name} size="md" className="mt-0.5 bg-brand-600 text-white" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{invitation.inviter.name}</span>{' '}
            {strings.invitations.invitedYouToJoin}{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{invitation.group.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{timeAgo(invitation.createdAt)}</p>

          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" loading={busy} onClick={() => respond(invitation, 'ACCEPTED')}>
              {strings.invitations.accept}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => respond(invitation, 'REJECTED')}>
              {strings.invitations.decline}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
