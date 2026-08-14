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
  isOwn,
  canDelete,
  onDelete
}: {
  message: CommunityMessage;
  members: Member[];
  mentionNames: Record<string, string>;
  isOwn: boolean;
  canDelete: boolean;
  onDelete: (message: CommunityMessage) => void;
}) {
  const typeLabel = strings.community.types[message.type as keyof typeof strings.community.types];

  return (
    <li
      className={`rounded-2xl border px-4 py-3 ${
        message.system ? (TYPE_TONES[message.type] ?? TYPE_TONES.SYSTEM) : 'border-slate-100 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar
          name={message.system ? appConfig.name : message.authorName}
          image={message.system ? null : message.authorImage}
          size="sm"
          muted={message.system}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-900">{message.authorName}</span>
            {isOwn && <span className="text-xs text-green-600">{strings.common.you}</span>}
            {message.system && typeLabel && (
              <Badge tone={message.type === 'ANNOUNCEMENT' ? 'warning' : 'success'}>{typeLabel}</Badge>
            )}
            <span className="text-xs text-slate-400">{timeAgo(message.createdAt)}</span>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(message)}
                aria-label={strings.community.deleteAction}
                title={strings.community.deleteAction}
                className="-my-1.5 ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            )}
          </div>

          {message.title && <p className="mt-1 text-sm font-semibold text-slate-900">{message.title}</p>}

          {message.text && (
            <MentionText
              text={message.text}
              members={members}
              mentionNames={mentionNames}
              className="mt-1 hyphens-auto whitespace-pre-wrap break-words text-justify text-sm text-slate-700"
            />
          )}

          <ImageGrid images={message.images} authorName={message.authorName} />
        </div>
      </div>
    </li>
  );
}

export default PostCard;
