import Link from 'next/link';
import { timeAgo } from '@/components/InvitationsProvider';
import { Badge } from '@/components/ui';
import { LikeButton } from '@/components/tolet/LikeButton';
import { formatCurrency } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { TOLET_GENDER_PREFERENCE } from '@/lib/constants';
import { toLetListingPath } from '@/lib/routes';
import type { ToLetListingView } from '@/lib/tolet';

export function ToLetCard({
  listing,
  onLikeChange
}: {
  listing: ToLetListingView;
  onLikeChange: (listingId: string, liked: boolean, count: number) => void;
}) {
  const cover = listing.images[0] ?? null;

  return (
    <li className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link href={toLetListingPath(listing.id)} className="block">
        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
          {cover ? (
            <img
              src={cover}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
              {strings.toLet.noPhotos}
            </div>
          )}
        </div>

        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{strings.toLet.types[listing.type as keyof typeof strings.toLet.types]}</Badge>
            {listing.genderPreference !== TOLET_GENDER_PREFERENCE.ANY && (
              <Badge tone="warning">
                {strings.toLet.genderPreference[listing.genderPreference as keyof typeof strings.toLet.genderPreference]}
              </Badge>
            )}
          </div>

          <p className="truncate text-[15px] font-semibold text-slate-900">{listing.title}</p>

          <p className="flex items-baseline gap-1.5 text-lg font-semibold text-brand-700">
            {strings.toLet.rentPerMonth(formatCurrency(listing.rent))}
            {listing.rentNegotiable && (
              <span className="text-xs font-normal text-slate-400">{strings.toLet.negotiable}</span>
            )}
          </p>

          <p className="truncate text-sm text-slate-500">{listing.location}</p>

          <p className="text-xs text-slate-400">{timeAgo(listing.createdAt)}</p>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
        <LikeButton
          listingId={listing.id}
          liked={listing.likedByViewer}
          count={listing.likeCount}
          compact
          onChange={(liked, count) => onLikeChange(listing.id, liked, count)}
        />
        <span className="text-xs text-slate-400">{strings.toLet.commentsCount(listing.commentCount)}</span>
      </div>
    </li>
  );
}

export default ToLetCard;
