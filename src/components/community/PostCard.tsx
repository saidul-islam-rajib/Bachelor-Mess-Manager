import { useState } from 'react';
import Link from 'next/link';
import { CommunityComments } from '@/components/community/CommunityComments';
import { ImageGrid } from '@/components/community/ImageGrid';
import { LikeButton } from '@/components/community/LikeButton';
import { timeAgo } from '@/components/InvitationsProvider';
import { MentionText, type Member } from '@/components/MentionInput';
import { Avatar, Badge } from '@/components/ui';
import { appConfig } from '@/config';
import { COMMUNITY_MESSAGE_TYPES, TOLET_POST_LAYOUTS, TOLET_TENANT_RESTRICTION } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { toLetListingPath } from '@/lib/routes';
import { useToLetPostLayout } from '@/lib/useToLetPostLayout';
import type { CommunityMessageView } from '@/lib/community';

export type CommunityMessage = CommunityMessageView;

const TYPE_TONES: Record<string, string> = {
  WELCOME: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10',
  ANNOUNCEMENT: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10',
  SYSTEM: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
};

const BATH_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10l8-6 8 6v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
  </svg>
);
const BALCONY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="4" />
    <path d="M5 12v8M19 12v8" />
  </svg>
);
const SEATS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3" />
    <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
  </svg>
);
const MEALS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11h18" />
    <path d="M5 11a7 7 0 0 1 14 0" />
    <path d="M4 15h16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
  </svg>
);

type FactItem = { icon: React.ReactNode; label: string };

function toLetFacts(message: CommunityMessage): FactItem[] {
  const facts: FactItem[] = [];
  if (message.seatsAvailable) facts.push({ icon: SEATS_ICON, label: strings.toLet.seatsOpen(message.seatsAvailable) });
  if (message.attachedBath) facts.push({ icon: BATH_ICON, label: strings.toLet.attachedBathShort });
  if (message.attachedBalcony) facts.push({ icon: BALCONY_ICON, label: strings.toLet.attachedBalconyShort });
  if (message.mealsProvided) facts.push({ icon: MEALS_ICON, label: strings.toLet.mealsProvidedShort });
  return facts;
}

function ToLetBadges({ message }: { message: CommunityMessage }) {
  const tenantRestrictionValue = message.tenantRestriction ?? TOLET_TENANT_RESTRICTION.ANY;
  const isBachelor = tenantRestrictionValue === TOLET_TENANT_RESTRICTION.BACHELOR;
  const tenantRestrictionLabel =
    strings.toLet.tenantRestriction[tenantRestrictionValue as keyof typeof strings.toLet.tenantRestriction];

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {message.isSublet && <Badge tone="warning">{strings.toLet.sublet}</Badge>}
      <Badge tone="neutral">{strings.toLet.types[(message.listingType ?? '') as keyof typeof strings.toLet.types]}</Badge>
      <Badge tone={tenantRestrictionValue === TOLET_TENANT_RESTRICTION.ANY ? 'neutral' : 'info'}>
        {tenantRestrictionLabel}
      </Badge>
      {isBachelor && message.genderPreference && message.genderPreference !== 'ANY' && (
        <Badge tone="warning">
          {strings.toLet.genderPreference[message.genderPreference as keyof typeof strings.toLet.genderPreference]}
        </Badge>
      )}
      {isBachelor && message.houseRules && (
        <Badge tone={message.houseRules === 'STRICT' ? 'danger' : 'success'}>
          {strings.toLet.houseRules[message.houseRules as keyof typeof strings.toLet.houseRules]}
        </Badge>
      )}
      <Link href={toLetListingPath(message.id)} className="mt-1 text-sm font-medium text-brand-700 hover:text-brand-800">
        {strings.toLet.viewAction}
      </Link>
    </div>
  );
}

function ToLetAmenityChips({ amenities }: { amenities: string[] }) {
  if (amenities.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {amenities.map((amenity) => (
        <span
          key={amenity}
          className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300"
        >
          {strings.toLet.amenities[amenity as keyof typeof strings.toLet.amenities] ?? amenity}
        </span>
      ))}
    </div>
  );
}

function SignboardFactsRow({ facts }: { facts: FactItem[] }) {
  if (facts.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-y border-dashed border-slate-100 dark:border-slate-700 py-2">
      {facts.map((fact) => (
        <span key={fact.label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500">{fact.icon}</span>
          {fact.label}
        </span>
      ))}
    </div>
  );
}

function WalkthroughFactsRow({ facts }: { facts: FactItem[] }) {
  if (facts.length === 0) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-y border-dashed border-slate-100 dark:border-slate-700 py-2 text-xs text-slate-500 dark:text-slate-400">
      {facts.map((fact, index) => (
        <span key={fact.label}>
          {index > 0 && <span className="mr-3 text-slate-300 dark:text-slate-600">&middot;</span>}
          {fact.label}
        </span>
      ))}
    </p>
  );
}

export function PostCard({
  message,
  members,
  mentionNames,
  canDelete,
  canModerate,
  onDelete,
  onLikeChange,
  onCommentCountChange,
  distanceKm
}: {
  message: CommunityMessage;
  members: Member[];
  mentionNames: Record<string, string>;
  canDelete: boolean;
  canModerate: boolean;
  onDelete: (message: CommunityMessage) => void;
  onLikeChange: (messageId: string, liked: boolean, count: number) => void;
  onCommentCountChange?: (messageId: string, count: number) => void;
  distanceKm?: number | null;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const layout = useToLetPostLayout();
  const typeLabel = strings.community.types[message.type as keyof typeof strings.community.types];
  const isToLet = message.type === COMMUNITY_MESSAGE_TYPES.TOLET;
  const interactive = !message.system;
  const facts = isToLet ? toLetFacts(message) : [];

  return (
    <li
      className={`overflow-hidden rounded-2xl border shadow-sm ${
        message.system ? (TYPE_TONES[message.type] ?? TYPE_TONES.SYSTEM) : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
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
            <p className="truncate text-[15px] font-semibold leading-tight text-slate-900 dark:text-slate-100">{message.authorName}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
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
            className="-mr-1.5 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
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
        <div className="flex gap-3 px-4 pb-3 pt-2">
          <div className="min-w-0 flex-1">
            {message.title && <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{message.title}</p>}

            <p className="mt-0.5 flex items-baseline gap-1.5 text-lg font-semibold text-brand-700">
              {message.rent !== null && strings.toLet.rentPerMonth(formatCurrency(message.rent))}
              {message.rentNegotiable && (
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{strings.toLet.negotiable}</span>
              )}
              {message.serviceChargeIncluded ? (
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{strings.toLet.includesService}</span>
              ) : (
                message.rent !== null && (
                  <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{strings.toLet.excludesService}</span>
                )
              )}
            </p>

            {message.location && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {message.location}
                {distanceKm !== undefined && distanceKm !== null && (
                  <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                    · {strings.toLet.search.distanceAway(distanceKm.toFixed(1))}
                  </span>
                )}
              </p>
            )}

            {message.availableMonth && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {strings.toLet.availableFromMonth(strings.toLet.months[message.availableMonth as keyof typeof strings.toLet.months])}
              </p>
            )}

            {layout === TOLET_POST_LAYOUTS.WALKTHROUGH ? (
              <WalkthroughFactsRow facts={facts} />
            ) : (
              <SignboardFactsRow facts={facts} />
            )}

            {message.text && (
              <MentionText
                text={message.text}
                members={members}
                mentionNames={mentionNames}
                className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800 dark:text-slate-200"
              />
            )}

            <ToLetAmenityChips amenities={message.amenities} />
          </div>

          <ToLetBadges message={message} />
        </div>
      ) : (
        (message.title || message.text) && (
          <div className="px-4 pb-3 pt-2">
            {message.title && <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{message.title}</p>}
            {message.text && (
              <MentionText
                text={message.text}
                members={members}
                mentionNames={mentionNames}
                className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800 dark:text-slate-200"
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
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3">
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
              className="text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700"
            >
              {strings.toLet.commentsCount(message.commentCount)}
            </button>
          </div>

          {commentsOpen && (
            <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
              <CommunityComments
                messageId={message.id}
                canModerate={canModerate}
                onCountChange={(count) => onCommentCountChange?.(message.id, count)}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default PostCard;
