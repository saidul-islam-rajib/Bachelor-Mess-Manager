import InvitationCard from '@/components/InvitationCard';
import { useInvitations } from '@/components/InvitationsProvider';
import { Card, EmptyState, LoadingCard, PageContainer, PageHeader, Badge } from '@/components/ui';
import { strings } from '@/lib/i18n';

export default function InvitationsPage() {
  const { invitations, count, loading } = useInvitations();

  return (
    <PageContainer width="medium">
      <PageHeader
        title={strings.invitations.title}
        description={strings.invitations.subtitle}
        action={count > 0 ? <Badge tone="warning">{strings.invitations.pendingBadge(count)}</Badge> : null}
      />

      {loading && count === 0 ? (
        <LoadingCard />
      ) : count === 0 ? (
        <EmptyState title={strings.invitations.none} description={strings.invitations.noneHint} />
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-slate-100">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <InvitationCard invitation={invitation} compact />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageContainer>
  );
}
