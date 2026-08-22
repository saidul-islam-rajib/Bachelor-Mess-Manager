import { useState } from 'react';
import Link from 'next/link';
import { CommunityComments } from '@/components/community/CommunityComments';
import { ImageGrid } from '@/components/community/ImageGrid';
import { LikeButton } from '@/components/community/LikeButton';
import { timeAgo } from '@/components/InvitationsProvider';
import { MentionText, type Member } from '@/components/MentionInput';
import { Avatar, Badge } from '@/components/ui';
import { appConfig } from '@/config';
import { COMMUNITY_MESSAGE_TYPES, TOLET_GENDER_PREFERENCE, TOLET_TENANT_RESTRICTION } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { toLetListingPath } from '@/lib/routes';
import type { CommunityMessageView } from '@/lib/community';

export type CommunityMessage = CommunityMessageView;

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
  canModerate,
  onDelete,
  onLikeChange,
  distanceKm
}: {
  message: CommunityMessage;
  members: Member[];
  mentionNames: Record<string, string>;
  canDelete: boolean;
  canModerate: boolean;
  onDelete: (message: CommunityMessage) => void;
  onLikeChange: (messageId: string, liked: boolean, count: number) => void;
  distanceKm?: number | null;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const typeLabel = strings.community.types[message.type as keyof typeof strings.community.types];
  const isToLet = message.type === COMMUNITY_MESSAGE_TYPES.TOLET;
  const interactive = !message.system;
  const tenantRestrictionValue = message.tenantRestriction ?? TOLET_TENANT_RESTRICTION.ANY;
  const tenantRestrictionLabel =
    strings.toLet.tenantRestriction[tenantRestrictionValue as keyof typeof strings.toLet.tenantRestriction];

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

      {isToLet ? (
        <div className="px-4 pb-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">
              {strings.toLet.types[(message.listingType ?? '') as keyof typeof strings.toLet.types]}
            </Badge>
            {message.genderPreference && message.genderPreference !== TOLET_GENDER_PREFERENCE.ANY && (
              <Badge tone="warning">
                {strings.toLet.genderPreference[message.genderPreference as keyof typeof strings.toLet.genderPreference]}
              </Badge>
            )}
            <Badge tone={tenantRestrictionValue === TOLET_TENANT_RESTRICTION.ANY ? 'neutral' : 'info'}>
              {tenantRestrictionLabel}
            </Badge>
          </div>

          {message.title && <p className="mt-1.5 text-[15px] font-semibold text-slate-900">{message.title}</p>}

          <p className="mt-0.5 flex items-baseline gap-1.5 text-lg font-semibold text-brand-700">
            {message.rent !== null && strings.toLet.rentPerMonth(formatCurrency(message.rent))}
            {message.rentNegotiable && (
              <span className="text-xs font-normal text-slate-400">{strings.toLet.negotiable}</span>
            )}
          </p>

          {message.location && (
            <p className="text-sm text-slate-500">
              {message.location}
              {distanceKm !== undefined && distanceKm !== null && (
                <span className="ml-1.5 text-xs text-slate-400">
                  · {strings.toLet.search.distanceAway(distanceKm.toFixed(1))}
                </span>
              )}
            </p>
          )}

          {message.availableMonth && (
            <p className="text-xs text-slate-400">
              {strings.toLet.availableFromMonth(strings.toLet.months[message.availableMonth as keyof typeof strings.toLet.months])}
            </p>
          )}

          {message.text && (
            <MentionText
              text={message.text}
              members={members}
              mentionNames={mentionNames}
              className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800"
            />
          )}

          <Link
            href={toLetListingPath(message.id)}
            className="mt-2 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            {strings.toLet.viewAction}
          </Link>
        </div>
      ) : (
        (message.title || message.text) && (
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
        )
      )}

      {message.images.length > 0 && (
        <div className={message.title || message.text ? '' : 'mt-3'}>
          <ImageGrid images={message.images} authorName={message.authorName} />
        </div>
      )}

      {message.images.length === 0 && !isToLet && <div className="pb-1" />}

      {interactive && (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <LikeButton
              messageId={message.id}
              liked={message.likedByViewer}
              count={message.likeCount}
              compact
              onChange={(liked, count) => onLikeChange(message.id, liked, count)}
            />
            <button
              type="button"
              onClick={() => setCommentsOpen((open) => !open)}
              className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              {strings.toLet.commentsCount(message.commentCount)}
            </button>
          </div>

          {commentsOpen && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <CommunityComments messageId={message.id} canModerate={canModerate} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default PostCard;
