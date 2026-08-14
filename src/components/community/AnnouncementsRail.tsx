import type { CommunityMessage } from '@/components/community/PostCard';
import { timeAgo } from '@/components/InvitationsProvider';
import { Card, CardHeader } from '@/components/ui';
import { strings } from '@/lib/i18n';

const VISIBLE_COUNT = 3;

export function AnnouncementsRail({ messages }: { messages: CommunityMessage[] }) {
  const announcements = messages.filter((message) => message.type === 'ANNOUNCEMENT').slice(0, VISIBLE_COUNT);
  if (announcements.length === 0) return null;

  return (
    <Card>
      <CardHeader title={strings.community.announcementsTitle} />
      <ul className="mt-3 space-y-2.5">
        {announcements.map((announcement) => (
          <li key={announcement.id} className="rounded-xl bg-amber-50 px-3 py-2.5">
            {announcement.title && (
              <p className="text-sm font-semibold leading-tight text-slate-900">{announcement.title}</p>
            )}
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-600">{announcement.text}</p>
            <p className="mt-1 text-[11px] text-slate-400">{timeAgo(announcement.createdAt)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default AnnouncementsRail;
