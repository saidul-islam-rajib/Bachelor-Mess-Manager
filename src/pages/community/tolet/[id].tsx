import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import { CommunityComments } from '@/components/community/CommunityComments';
import { ToLetComposer } from '@/components/community/ToLetComposer';
import { ToLetGallery } from '@/components/community/ToLetGallery';
import { LikeButton } from '@/components/community/LikeButton';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  LoadingCard,
  PageContainer,
  PageTitle,
  ShareButtons,
  useConfirm
} from '@/components/ui';
import { COMMUNITY_MESSAGE_TYPES, TOLET_STATUS, TOLET_TENANT_RESTRICTION, USER_ROLES } from '@/lib/constants';
import { api, errorMessage } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import { googleMapsLink } from '@/lib/geo';
import { strings } from '@/lib/i18n';
import { publicBaseUrl } from '@/lib/password-tokens';
import { ROUTES, toLetListingPath } from '@/lib/routes';
import { getMessageForView, type CommunityMessageView } from '@/lib/community';

type PageProps = {
  initialListing: CommunityMessageView | null;
  pageUrl: string;
  ogImage: string | null;
};

export const getServerSideProps: GetServerSideProps<PageProps> = async (context) => {
  const id = typeof context.params?.id === 'string' ? context.params.id : null;
  if (!id) return { notFound: true };

  const message = await getMessageForView(id);
  if (!message || message.type !== COMMUNITY_MESSAGE_TYPES.TOLET) return { notFound: true };

  const baseUrl = publicBaseUrl(context.req);
  return {
    props: {
      initialListing: message,
      pageUrl: `${baseUrl}${toLetListingPath(message.id)}`,
      ogImage: message.images[0] ? `${baseUrl}${message.images[0]}` : null
    }
  };
};

export default function ToLetDetailPage({ initialListing, pageUrl, ogImage }: PageProps) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useCurrentUser();
  const id = typeof router.query.id === 'string' ? router.query.id : undefined;

  const [listing, setListing] = useState<CommunityMessageView | null>(initialListing);
  const [loading, setLoading] = useState(!initialListing);
  const [notFound, setNotFound] = useState(false);
  const [composerMode, setComposerMode] = useState<'edit' | 'repost' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setNotFound(false);

    api
      .get<{ message: CommunityMessageView }>(`/api/community/messages/${id}`)
      .then((data) => {
        if (!cancelled) setListing(data.message);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  function onLikeChange(liked: boolean, count: number) {
    setListing((current) => (current ? { ...current, likedByViewer: liked, likeCount: count } : current));
  }

  const isAdmin = user?.role === USER_ROLES.ADMIN;
  const isOwner = Boolean(user && listing && user.id === listing.authorId);
  const canManage = isOwner || isAdmin;

  async function markExpired() {
    if (!listing) return;
    const accepted = await confirm({
      title: strings.toLet.markExpiredConfirmTitle,
      message: strings.toLet.markExpiredConfirmBody,
      confirmLabel: strings.toLet.markExpiredAction
    });
    if (!accepted) return;

    setBusy(true);
    try {
      const data = await api.patch<{ message: CommunityMessageView }>(`/api/community/messages/${listing.id}`, {
        markExpired: true
      });
      setListing(data.message);
      toast.success(strings.toLet.markedExpired);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRepost() {
    if (!listing) return;
    const accepted = await confirm({
      title: strings.toLet.repostConfirmTitle,
      message: strings.toLet.repostConfirmBody,
      confirmLabel: strings.toLet.repostAction
    });
    if (!accepted) return;
    setComposerMode('repost');
  }

  function onReposted(updated: CommunityMessageView) {
    setComposerMode(null);
    void router.push(toLetListingPath(updated.id));
  }

  async function removeListing() {
    if (!listing) return;
    const accepted = await confirm({
      title: strings.toLet.deleteConfirmTitle,
      message: strings.toLet.deleteConfirmBody,
      confirmLabel: strings.common.delete,
      destructive: true
    });
    if (!accepted) return;

    setBusy(true);
    try {
      await api.delete(`/api/community/messages/${listing.id}`);
      toast.success(strings.toLet.deleted);
      void router.push(ROUTES.community);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <PageContainer width="medium">
        <LoadingCard />
      </PageContainer>
    );
  }

  if (notFound || !listing) {
    return (
      <PageContainer width="medium">
        <EmptyState
          title={strings.toLet.detailNotFound}
          action={
            <Link href={ROUTES.community} className="text-sm font-medium text-brand-700 hover:text-brand-800">
              {strings.toLet.backToBrowse}
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const typeLabel = strings.toLet.types[(listing.listingType ?? '') as keyof typeof strings.toLet.types];
  const genderLabel =
    listing.genderPreference && (strings.toLet.genderPreference[listing.genderPreference as keyof typeof strings.toLet.genderPreference] ?? null);
  const tenantRestrictionValue = listing.tenantRestriction ?? TOLET_TENANT_RESTRICTION.ANY;
  const restrictionLabel = strings.toLet.tenantRestriction[tenantRestrictionValue as keyof typeof strings.toLet.tenantRestriction];
  const availableMonthLabel = listing.availableMonth
    ? strings.toLet.availableFromMonth(strings.toLet.months[listing.availableMonth as keyof typeof strings.toLet.months])
    : null;
  const mapsLink = googleMapsLink(
    listing.latitude !== null && listing.longitude !== null ? { lat: listing.latitude, lng: listing.longitude } : null,
    listing.location
  );

  const detailFacts: { label: string; value: string }[] = [
    ...(listing.seatsAvailable ? [{ label: strings.toLet.composer.seatsAvailableLabel, value: strings.toLet.seatsOpen(listing.seatsAvailable) }] : []),
    ...(listing.attachedBath ? [{ label: strings.toLet.composer.attachedBathLabel, value: strings.common.yes }] : []),
    ...(listing.attachedBalcony ? [{ label: strings.toLet.composer.attachedBalconyLabel, value: strings.common.yes }] : []),
    ...(listing.advanceMonths !== null ? [{ label: strings.toLet.composer.advanceMonthsLabel, value: strings.toLet.composer.advanceMonthsOption(listing.advanceMonths) }] : []),
    { label: strings.toLet.composer.serviceChargeLabel, value: listing.serviceChargeIncluded ? strings.common.yes : strings.common.no },
    ...(listing.mealsProvided ? [{ label: strings.toLet.composer.mealsProvidedLabel, value: strings.common.yes }] : [])
  ];

  return (
    <PageContainer width="medium">
      <PageTitle
        title={listing.title ?? strings.toLet.postAction}
        description={listing.text.length > 200 ? `${listing.text.slice(0, 197)}...` : listing.text}
        image={ogImage ?? undefined}
        url={pageUrl}
      />

      <Link
        href={ROUTES.community}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700"
      >
        <span aria-hidden="true">&larr;</span> {strings.toLet.backToBrowse}
      </Link>

      {listing.effectiveListingStatus !== TOLET_STATUS.ACTIVE && (
        <Alert tone="warning" className="mb-4">
          {strings.toLet.expiredNotice}
        </Alert>
      )}

      <div className="space-y-5">
        <ToLetGallery images={listing.images} title={listing.title ?? ''} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">{typeLabel}</Badge>
              <Badge tone={tenantRestrictionValue === TOLET_TENANT_RESTRICTION.ANY ? 'neutral' : 'info'}>
                {restrictionLabel}
              </Badge>
              {listing.genderPreference !== 'ANY' && genderLabel && (
                <Badge tone="warning">{genderLabel}</Badge>
              )}
              {listing.houseRules && (
                <Badge tone={listing.houseRules === 'STRICT' ? 'danger' : 'success'}>
                  {strings.toLet.houseRules[listing.houseRules as keyof typeof strings.toLet.houseRules]}
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{listing.title}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {listing.location}
              {mapsLink && (
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1.5 font-medium text-brand-700 hover:text-brand-800"
                >
                  {strings.toLet.location.viewOnMap}
                </a>
              )}
            </p>
            {availableMonthLabel && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{availableMonthLabel}</p>}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold text-brand-700">
              {listing.rent !== null && strings.toLet.rentPerMonth(formatCurrency(listing.rent))}
            </p>
            {listing.rentNegotiable && <p className="text-xs text-slate-400 dark:text-slate-500">{strings.toLet.negotiable}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LikeButton messageId={listing.id} liked={listing.likedByViewer} count={listing.likeCount} onChange={onLikeChange} />
          <ShareButtons url={toLetListingPath(listing.id)} title={listing.title ?? ''} />
          <span className="text-xs text-slate-400 dark:text-slate-500">{strings.toLet.viewsCount(listing.viewCount)}</span>
        </div>

        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">{listing.text}</p>

        {detailFacts.length > 0 && (
          <dl className="grid grid-cols-2 gap-4 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:grid-cols-3">
            {detailFacts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{fact.label}</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {listing.amenities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {listing.amenities.map((amenity) => (
              <span
                key={amenity}
                className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                {strings.toLet.amenities[amenity as keyof typeof strings.toLet.amenities] ?? amenity}
              </span>
            ))}
          </div>
        )}

        <dl className="grid gap-4 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{strings.toLet.contactTitle}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              {listing.contactName ?? listing.authorName}
              {listing.contactPhone ? ` · ${listing.contactPhone}` : ` · ${strings.toLet.noContactPhone}`}
            </dd>
            {listing.contactWhatsapp && (
              <dd className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{strings.toLet.composer.whatsappLabel}: {listing.contactWhatsapp}</dd>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{strings.toLet.postedBy(listing.authorName)}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{strings.toLet.postedOn(formatDate(listing.createdAt))}</dd>
          </div>
        </dl>

        {canManage && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-700 pt-4">
            <Button variant="secondary" size="sm" onClick={() => setComposerMode('edit')} disabled={busy}>
              {strings.toLet.editAction}
            </Button>
            {listing.effectiveListingStatus === TOLET_STATUS.ACTIVE ? (
              <Button variant="secondary" size="sm" onClick={() => void markExpired()} disabled={busy}>
                {strings.toLet.markExpiredAction}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => void confirmRepost()} disabled={busy}>
                {strings.toLet.repostAction}
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => void removeListing()} disabled={busy}>
              {strings.toLet.deleteAction}
            </Button>
          </div>
        )}

        <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
          <h2 className="mb-3 text-lg font-semibold">{strings.community.comments.title}</h2>
          <CommunityComments messageId={listing.id} canModerate={isAdmin} />
        </div>
      </div>

      {canManage && (
        <ToLetComposer
          open={composerMode !== null}
          onClose={() => setComposerMode(null)}
          listing={composerMode === 'edit' ? listing : null}
          prefillFrom={composerMode === 'repost' ? listing : null}
          defaultContactName={user?.name ?? ''}
          defaultContactPhone={user?.phone ?? ''}
          onSaved={composerMode === 'repost' ? onReposted : (updated) => setListing(updated)}
        />
      )}
    </PageContainer>
  );
}
