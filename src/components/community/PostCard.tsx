import { ImageGrid } from '@/components/community/ImageGrid';
import { timeAgo } from '@/components/InvitationsProvider';
import { MentionText, type Member } from '@/components/MentionInput';
import { Avatar, Badge } from '@/components/ui';
import { appConfig } from '@/config';
import { strings } from '@/lib/i18n';

export type CommunityMessage = {
  id: string;
  type: string;
  system: boolean;
  authorId: string | null;
  authorName: string;
  authorImage: string | null;
  title: string | null;
  text: string;
  images: string[];
  pinned: boolean;
  createdAt: string;
};

const TYPE_TONES: Record<string, string> = {
  WELCOME: 'border-emerald-200 bg-emerald-50',
  ANNOUNCEMENT: 'border-amber-200 bg-amber-50',
  SYSTEM: 'border-slate-200 bg-slate-50'
};

export function PostCard({
  message,
  members,
  mentionNames,
  canDelete,
  onDelete
}: {
  message: CommunityMessage;
  members: Member[];
  mentionNames: Record<string, string>;
  canDelete: boolean;
  onDelete: (message: CommunityMessage) => void;
}) {
  const typeLabel = strings.community.types[message.type as keyof typeof strings.community.types];

  return (
    <li
      className={`overflow-hidden rounded-2xl border shadow-sm ${
        message.system ? (TYPE_TONES[message.type] ?? TYPE_TONES.SYSTEM) : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar
            name={message.system ? appConfig.name : message.authorName}
            image={message.system ? null : message.authorImage}
            size="md"
            muted={message.system}
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight text-slate-900">{message.authorName}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
              <span>{timeAgo(message.createdAt)}</span>
              {message.system && typeLabel && (
                <Badge tone={message.type === 'ANNOUNCEMENT' ? 'warning' : 'success'}>{typeLabel}</Badge>
              )}
            </div>
          </div>
        </div>

        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(message)}
            aria-label={strings.community.deleteAction}
            title={strings.community.deleteAction}
            className="-mr-1.5 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        )}
      </div>

      {(message.title || message.text) && (
        <div className="px-4 pb-3 pt-2">
          {message.title && <p className="text-[15px] font-semibold text-slate-900">{message.title}</p>}
          {message.text && (
            <MentionText
              text={message.text}
              members={members}
              mentionNames={mentionNames}
              className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800"
            />
          )}
        </div>
      )}

      {message.images.length > 0 && (
        <div className={message.title || message.text ? '' : 'mt-3'}>
          <ImageGrid images={message.images} authorName={message.authorName} />
        </div>
      )}

      {message.images.length === 0 && <div className="pb-1" />}
    </li>
  );
}

export default PostCard;
