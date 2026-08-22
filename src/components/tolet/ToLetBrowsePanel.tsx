import { useCallback, useEffect, useState } from 'react';
import { ToLetCard } from '@/components/tolet/ToLetCard';
import { ToLetComposer } from '@/components/tolet/ToLetComposer';
import { EMPTY_TOLET_FILTERS, ToLetFilters, type ToLetFilterValues } from '@/components/tolet/ToLetFilters';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { Button, EmptyState, LoadingCard, Pagination, useDebouncedValue } from '@/components/ui';
import { toLetConfig } from '@/config';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import type { Paginated } from '@/lib/query';
import type { ToLetListingView } from '@/lib/tolet';

export function ToLetBrowsePanel() {
  const toast = useToast();
  const { user } = useCurrentUser();
  const [filters, setFilters] = useState<ToLetFilterValues>(EMPTY_TOLET_FILTERS);
  const debouncedQ = useDebouncedValue(filters.q);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<ToLetListingView> | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filters.type, filters.minRent, filters.maxRent]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<ToLetListingView>>('/api/tolet', {
        query: {
          q: debouncedQ || undefined,
          type: filters.type || undefined,
          minRent: filters.minRent || undefined,
          maxRent: filters.maxRent || undefined,
          page,
          pageSize: toLetConfig.pageSize
        }
      });
      setResult(data);
    } catch (error) {
      toast.error(errorMessage(error, strings.toLet.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, filters.type, filters.minRent, filters.maxRent, page, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function onLikeChange(listingId: string, liked: boolean, count: number) {
    setResult((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.id === listingId ? { ...item, likedByViewer: liked, likeCount: count } : item
        )
      };
    });
  }

  function onPosted() {
    setPage(1);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">{strings.toLet.browseTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{strings.toLet.browseSubtitle}</p>
        </div>
        {user && <Button onClick={() => setComposerOpen(true)}>{strings.toLet.postAction}</Button>}
      </div>

      <ToLetFilters value={filters} onChange={setFilters} />

      {loading ? (
        <LoadingCard />
      ) : !result || result.items.length === 0 ? (
        <EmptyState title={strings.toLet.empty} description={strings.toLet.emptyHint} />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((listing) => (
              <ToLetCard key={listing.id} listing={listing} onLikeChange={onLikeChange} />
            ))}
          </ul>
          <Pagination meta={result.meta} onPageChange={setPage} disabled={loading} />
        </>
      )}

      {user && (
        <ToLetComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          listing={null}
          defaultContactName={user.name}
          defaultContactPhone={user.phone ?? ''}
          onSaved={onPosted}
        />
      )}
    </div>
  );
}

export default ToLetBrowsePanel;
