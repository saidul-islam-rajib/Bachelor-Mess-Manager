import { useCallback, useEffect, useRef, useState } from 'react';
import { AnnouncementsRail } from '@/components/community/AnnouncementsRail';
import { Composer } from '@/components/community/Composer';
import { PeopleRail } from '@/components/community/PeopleRail';
import { PostCard, type CommunityMessage } from '@/components/community/PostCard';
import { ToLetComposer } from '@/components/community/ToLetComposer';
import { ToLetImportModal } from '@/components/community/ToLetImportModal';
import { EMPTY_TOLET_SEARCH, ToLetSearchBar, isToLetSearchActive, type ToLetSearchState } from '@/components/community/ToLetSearchBar';
import { ToLetSearchResults } from '@/components/community/ToLetSearchResults';
import { useInfiniteScroll } from '@/components/community/useInfiniteScroll';
import type { Member } from '@/components/MentionInput';
import { useCommunity } from '@/components/CommunityProvider';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import {
  Alert,
  Button,
  EmptyState,
  LoadingCard,
  PageContainer,
  PageTitle,
  useConfirm
} from '@/components/ui';
import { communityConfig, toLetConfig } from '@/config';
import { api, errorMessage } from '@/lib/api-client';
import { USER_ROLES } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import type { PageMeta } from '@/lib/query';
import type { ToLetSearchResult } from '@/lib/community';
import type { ToLetImportResult } from '@/lib/tolet-import-parser';

const EMPTY_SEARCH_META: PageMeta = { page: 1, pageSize: 1, total: 0, totalPages: 0, hasPrevious: false, hasNext: false, from: 0, to: 0 };

type CommunityMember = Member & { profileImage: string | null };

type FeedResponse = {
  messages: CommunityMessage[];
  mentionNames: Record<string, string>;
  hasMore: boolean;
  members?: CommunityMember[];
  unreadCount: number;
  currentUserId: string | null;
  canMentionEveryone: boolean;
  canModerate: boolean;
  maxLength: number;
  maxImagesPerPost: number;
};

type FeedCache = {
  messages: CommunityMessage[];
  members: CommunityMember[];
  mentionNames: Record<string, string>;
  hasMore: boolean;
  canMentionEveryone: boolean;
  canModerate: boolean;
  maxLength: number;
  maxImagesPerPost: number;
};

let feedCache: FeedCache | null = null;

export default function CommunityPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useCurrentUser();
  const { markRead, setUnreadCount } = useCommunity();

  const [messages, setMessages] = useState<CommunityMessage[]>(feedCache?.messages ?? []);
  const [members, setMembers] = useState<CommunityMember[]>(feedCache?.members ?? []);
  const [mentionNames, setMentionNames] = useState<Record<string, string>>(feedCache?.mentionNames ?? {});
  const [hasMore, setHasMore] = useState(feedCache?.hasMore ?? false);
  const [canMentionEveryone, setCanMentionEveryone] = useState(feedCache?.canMentionEveryone ?? false);
  const [canModerate, setCanModerate] = useState(feedCache?.canModerate ?? false);
  const [maxLength, setMaxLength] = useState(feedCache?.maxLength ?? communityConfig.maxMessageLength);
  const [maxImagesPerPost, setMaxImagesPerPost] = useState(feedCache?.maxImagesPerPost ?? communityConfig.maxImagesPerPost);

  const [loading, setLoading] = useState(!feedCache);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newPostsPending, setNewPostsPending] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [toLetComposerOpen, setToLetComposerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importedFields, setImportedFields] = useState<ToLetImportResult | null>(null);
  const isAdmin = user?.role === USER_ROLES.ADMIN;

  const [search, setSearch] = useState<ToLetSearchState>(EMPTY_TOLET_SEARCH);
  const [searchPage, setSearchPage] = useState(1);
  const [searchResult, setSearchResult] = useState<ToLetSearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searching = isToLetSearchActive(search);

  const latestSeenAt = useRef<string | null>(feedCache?.messages[0]?.createdAt ?? null);
  const sentinel = useRef<HTMLDivElement>(null);
  const hadCacheOnMount = useRef(Boolean(feedCache)).current;

  useEffect(() => {
    feedCache = { messages, members, mentionNames, hasMore, canMentionEveryone, canModerate, maxLength, maxImagesPerPost };
  }, [messages, members, mentionNames, hasMore, canMentionEveryone, canModerate, maxLength, maxImagesPerPost]);

  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) setLoading(true);
      try {
        const data = await api.get<FeedResponse>('/api/community/messages');
        setMessages(data.messages);
        setMembers(data.members ?? []);
        setMentionNames(data.mentionNames);
        setHasMore(data.hasMore);
        setCanMentionEveryone(data.canMentionEveryone);
        setCanModerate(data.canModerate);
        setMaxLength(data.maxLength);
        setMaxImagesPerPost(data.maxImagesPerPost);
        latestSeenAt.current = data.messages[0]?.createdAt ?? latestSeenAt.current;
        setNewPostsPending(0);
        markRead();
      } catch (error) {
        if (!options.silent) toast.error(errorMessage(error, strings.errors.loadFailed(strings.community.title)));
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    [markRead, toast]
  );

  useEffect(() => {
    void load({ silent: hadCacheOnMount });
  }, [load, hadCacheOnMount]);

  const pull = useCallback(async () => {
    if (!user || !latestSeenAt.current) return;

    try {
      const data = await api.get<FeedResponse>('/api/community/messages', {
        query: { after: latestSeenAt.current }
      });
      if (data.messages.length === 0) return;

      latestSeenAt.current = data.messages[0].createdAt;
      setNewPostsPending((count) => count + data.messages.length);
    } catch {
      return;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const timer = setInterval(pull, communityConfig.pollIntervalMs);
    const onFocus = () => pull();

    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [pull, user]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;

    const oldest = messages[messages.length - 1];
    if (!oldest) return;

    setLoadingMore(true);
    try {
      const data = await api.get<FeedResponse>('/api/community/messages', {
        query: { before: oldest.createdAt }
      });
      setMessages((current) => [...current, ...data.messages]);
      setMentionNames((current) => ({ ...current, ...data.mentionNames }));
      setHasMore(data.hasMore);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  useInfiniteScroll({ target: sentinel, onIntersect: loadMore, enabled: !loading && !searching && hasMore, rootMargin: '800px' });

  useEffect(() => {
    setSearchPage(1);
  }, [search.q, search.type, search.minRent, search.maxRent]);

  useEffect(() => {
    if (!searching) {
      setSearchResult(null);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    api
      .get<{ mode: 'search' } & ToLetSearchResult>('/api/community/messages', {
        query: {
          q: search.q || undefined,
          type: search.type || undefined,
          minRent: search.minRent || undefined,
          maxRent: search.maxRent || undefined,
          page: searchPage,
          pageSize: toLetConfig.searchPageSize
        }
      })
      .then((data) => {
        if (!cancelled) setSearchResult(data);
      })
      .catch((error) => {
        if (!cancelled) toast.error(errorMessage(error, strings.toLet.search.loadFailed));
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searching, search, searchPage, toast]);

  function onPosted(message: CommunityMessage) {
    setMessages((current) => [message, ...current]);
    latestSeenAt.current = message.createdAt;
    setUnreadCount(0);
  }

  function onLikeChange(messageId: string, liked: boolean, count: number) {
    setMessages((current) =>
      current.map((item) => (item.id === messageId ? { ...item, likedByViewer: liked, likeCount: count } : item))
    );
    setSearchResult((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === messageId ? { ...item, likedByViewer: liked, likeCount: count } : item))
          }
        : current
    );
  }

  function onCommentCountChange(messageId: string, count: number) {
    setMessages((current) => current.map((item) => (item.id === messageId ? { ...item, commentCount: count } : item)));
    setSearchResult((current) =>
      current
        ? { ...current, items: current.items.map((item) => (item.id === messageId ? { ...item, commentCount: count } : item)) }
        : current
    );
  }

  async function remove(message: CommunityMessage) {
    const accepted = await confirm({
      title: strings.community.deleteConfirmTitle,
      message: strings.community.deleteConfirmBody,
      confirmLabel: strings.common.delete,
      destructive: true
    });
    if (!accepted) return;

    try {
      await api.delete(`/api/community/messages/${message.id}`);
      setMessages((current) => current.filter((item) => item.id !== message.id));
      setSearchResult((current) =>
        current ? { ...current, items: current.items.filter((item) => item.id !== message.id) } : current
      );
      toast.success(strings.community.deleted);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const canDelete = (message: CommunityMessage) =>
    Boolean(user) && (canModerate || (!message.system && message.authorId === user?.id));

  return (
    <PageContainer>
      <PageTitle title={strings.community.title} />
      {!user && <Alert className="mb-4">{strings.community.signedOutHint}</Alert>}

      <div className="grid gap-4 lg:grid-cols-[65fr_35fr]">
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <ToLetSearchBar
              value={search}
              onChange={setSearch}
              previewItems={searchResult?.items ?? []}
              userName={user?.name}
              userImage={user?.profileImage}
              onOpenComposer={user ? () => setComposerOpen(true) : undefined}
              onOpenToLet={user ? () => setToLetComposerOpen(true) : undefined}
              onOpenImport={isAdmin ? () => setImportOpen(true) : undefined}
            />
          </div>

          {searching ? (
            <ToLetSearchResults
              items={searchResult?.items ?? []}
              meta={searchResult?.meta ?? EMPTY_SEARCH_META}
              fallback={searchResult?.fallback ?? null}
              loading={searchLoading}
              members={members}
              mentionNames={mentionNames}
              canModerate={canModerate}
              canDelete={canDelete}
              onDelete={remove}
              onLikeChange={onLikeChange}
              onCommentCountChange={onCommentCountChange}
              onPageChange={setSearchPage}
            />
          ) : (
            <>
              {newPostsPending > 0 && (
                <div className="flex justify-center">
                  <Button size="sm" variant="secondary" onClick={() => load()}>
                    {strings.community.newMessages(newPostsPending)} · {strings.community.jumpToLatest}
                  </Button>
                </div>
              )}

              {loading ? (
                <LoadingCard />
              ) : messages.length === 0 ? (
                <EmptyState title={strings.community.empty} />
              ) : (
                <>
                  <ul className="space-y-3">
                    {messages.map((message) => (
                      <PostCard
                        key={message.id}
                        message={message}
                        members={members}
                        mentionNames={mentionNames}
                        canDelete={canDelete(message)}
                        canModerate={canModerate}
                        onDelete={remove}
                        onLikeChange={onLikeChange}
                        onCommentCountChange={onCommentCountChange}
                      />
                    ))}
                  </ul>

                  <div ref={sentinel} className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                    {loadingMore ? strings.community.loadingOlder : !hasMore ? strings.community.endOfFeed : null}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-24 space-y-4 pb-4">
            <AnnouncementsRail messages={messages} />
            <PeopleRail members={members} />
          </div>
        </div>
      </div>

      {user && (
        <Composer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          members={members}
          maxLength={maxLength}
          maxImagesPerPost={maxImagesPerPost}
          allowEveryone={canMentionEveryone}
          onPosted={onPosted}
        />
      )}

      {user && (
        <ToLetComposer
          open={toLetComposerOpen}
          onClose={() => {
            setToLetComposerOpen(false);
            setImportedFields(null);
          }}
          listing={null}
          importedFields={importedFields}
          defaultContactName={user.name}
          defaultContactPhone={user.phone ?? ''}
          onSaved={onPosted}
        />
      )}

      {isAdmin && (
        <ToLetImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onParsed={(result) => {
            setImportedFields(result);
            setImportOpen(false);
            setToLetComposerOpen(true);
          }}
        />
      )}
    </PageContainer>
  );
}
