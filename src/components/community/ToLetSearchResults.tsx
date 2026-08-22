import { PostCard, type CommunityMessage } from '@/components/community/PostCard';
import type { Member } from '@/components/MentionInput';
import { Alert, EmptyState, LoadingCard, Pagination } from '@/components/ui';
import { strings } from '@/lib/i18n';
import type { PageMeta } from '@/lib/query';
import type { ToLetSearchFallback, ToLetSearchItem } from '@/lib/community';

export function ToLetSearchResults({
  items,
  meta,
  fallback,
  loading,
  members,
  mentionNames,
  canModerate,
  canDelete,
  onDelete,
  onLikeChange,
  onCommentCountChange,
  onPageChange
}: {
  items: ToLetSearchItem[];
  meta: PageMeta;
  fallback: ToLetSearchFallback;
  loading: boolean;
  members: Member[];
  mentionNames: Record<string, string>;
  canModerate: boolean;
  canDelete: (message: CommunityMessage) => boolean;
  onDelete: (message: CommunityMessage) => void;
  onLikeChange: (messageId: string, liked: boolean, count: number) => void;
  onCommentCountChange?: (messageId: string, count: number) => void;
  onPageChange: (page: number) => void;
}) {
  if (loading) return <LoadingCard />;

  if (items.length === 0) {
    return <EmptyState title={strings.toLet.search.noResults} description={strings.toLet.search.noResultsHint} />;
  }

  return (
    <div className="space-y-3">
      {fallback && <Alert tone="info">{strings.toLet.search.nearestBanner(fallback.query)}</Alert>}

      <ul className="space-y-3">
        {items.map((item) => (
          <PostCard
            key={item.id}
            message={item}
            members={members}
            mentionNames={mentionNames}
            canDelete={canDelete(item)}
            canModerate={canModerate}
            onDelete={onDelete}
            onLikeChange={onLikeChange}
            onCommentCountChange={onCommentCountChange}
            distanceKm={item.distanceKm}
          />
        ))}
      </ul>

      {!fallback && <Pagination meta={meta} onPageChange={onPageChange} />}
    </div>
  );
}

export default ToLetSearchResults;
