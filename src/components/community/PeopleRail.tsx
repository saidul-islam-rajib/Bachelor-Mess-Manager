import type { Member } from '@/components/MentionInput';
import { ActionLink, Avatar, Card, CardHeader } from '@/components/ui';
import { strings } from '@/lib/i18n';
import { ROUTES } from '@/lib/routes';

const VISIBLE_COUNT = 8;

export function PeopleRail({ members }: { members: (Member & { profileImage?: string | null })[] }) {
  if (members.length === 0) return null;

  const shown = members.slice(0, VISIBLE_COUNT);

  return (
    <Card>
      <CardHeader title={strings.community.people} />
      <ul className="mt-3 space-y-3">
        {shown.map((member) => (
          <li key={member.id} className="flex items-center gap-2.5">
            <Avatar name={member.name} image={member.profileImage ?? null} size="sm" />
            <span className="min-w-0 truncate text-sm text-slate-700">{member.name}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <ActionLink href={ROUTES.members}>{strings.community.viewAllMembers}</ActionLink>
      </div>
    </Card>
  );
}

export default PeopleRail;
