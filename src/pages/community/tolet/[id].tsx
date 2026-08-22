import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ToLetComments } from '@/components/tolet/ToLetComments';
import { ToLetComposer } from '@/components/tolet/ToLetComposer';
import { ToLetGallery } from '@/components/tolet/ToLetGallery';
import { LikeButton } from '@/components/tolet/LikeButton';
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
import { TOLET_GENDER_PREFERENCE, TOLET_STATUS, USER_ROLES } from '@/lib/constants';
import { api, errorMessage } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { ROUTES, toLetListingPath } from '@/lib/routes';
import type { ToLetListingView } from '@/lib/tolet';

export default function ToLetDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useCurrentUser();
  const id = typeof router.query.id === 'string' ? router.query.id : undefined;

  const [listing, setListing] = useState<ToLetListingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    api
      .get<{ listing: ToLetListingView }>(`/api/tolet/${id}`)
      .then((data) => {
        if (!cancelled) setListing(data.listing);
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
      const data = await api.patch<{ listing: ToLetListingView }>(`/api/tolet/${listing.id}`, { markExpired: true });
      setListing(data.listing);
      toast.success(strings.toLet.markedExpired);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
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
      await api.delete(`/api/tolet/${listing.id}`);
      toast.success(strings.toLet.deleted);
      void router.push(`${ROUTES.community}?tab=tolet`);
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
            <Link
              href={`${ROUTES.community}?tab=tolet`}
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              {strings.toLet.backToBrowse}
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const typeLabel = strings.toLet.types[listing.type as keyof typeof strings.toLet.types];
  const genderLabel = strings.toLet.genderPreference[listing.genderPreference as keyof typeof strings.toLet.genderPreference];

  return (
    <PageContainer width="medium">
      <PageTitle title={listing.title} description={listing.description} />

      <Link
        href={`${ROUTES.community}?tab=tolet`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <span aria-hidden="true">&larr;</span> {strings.toLet.backToBrowse}
      </Link>

      {listing.effectiveStatus !== TOLET_STATUS.ACTIVE && (
        <Alert tone="warning" className="mb-4">
          {strings.toLet.expiredNotice}
        </Alert>
      )}

      <div className="space-y-5">
        <ToLetGallery images={listing.images} title={listing.title} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">{typeLabel}</Badge>
              {listing.genderPreference !== TOLET_GENDER_PREFERENCE.ANY && <Badge tone="warning">{genderLabel}</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{listing.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{listing.location}</p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold text-brand-700">
              {strings.toLet.rentPerMonth(formatCurrency(listing.rent))}
            </p>
            {listing.rentNegotiable && <p className="text-xs text-slate-400">{strings.toLet.negotiable}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LikeButton listingId={listing.id} liked={listing.likedByViewer} count={listing.likeCount} onChange={onLikeChange} />
          <ShareButtons url={toLetListingPath(listing.id)} title={listing.title} />
          <span className="text-xs text-slate-400">{strings.toLet.viewsCount(listing.viewCount)}</span>
        </div>

        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">{listing.description}</p>

        <dl className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">{strings.toLet.composer.availableFromLabel}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">
              {listing.availableFrom
                ? strings.toLet.availableFromValue(formatDate(listing.availableFrom))
                : strings.toLet.availableNow}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">{strings.toLet.contactTitle}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">
              {listing.contactName ?? listing.authorName}
              {listing.contactPhone ? ` · ${listing.contactPhone}` : ` · ${strings.toLet.noContactPhone}`}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-slate-400">
          {strings.toLet.postedBy(listing.authorName)} · {strings.toLet.postedOn(formatDate(listing.createdAt))}
        </p>

        {canManage && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" size="sm" onClick={() => setEditorOpen(true)} disabled={busy}>
              {strings.toLet.editAction}
            </Button>
            {listing.effectiveStatus === TOLET_STATUS.ACTIVE && (
              <Button variant="secondary" size="sm" onClick={() => void markExpired()} disabled={busy}>
                {strings.toLet.markExpiredAction}
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => void removeListing()} disabled={busy}>
              {strings.toLet.deleteAction}
            </Button>
          </div>
        )}

        <div className="border-t border-slate-100 pt-5">
          <ToLetComments listingId={listing.id} canModerate={isAdmin} />
        </div>
      </div>

      {canManage && (
        <ToLetComposer
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          listing={listing}
          defaultContactName={user?.name ?? ''}
          defaultContactPhone={user?.phone ?? ''}
          onSaved={(updated) => setListing(updated)}
        />
      )}
    </PageContainer>
  );
}
