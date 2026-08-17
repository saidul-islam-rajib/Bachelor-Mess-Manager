import { useCallback, useEffect, useRef, useState } from 'react';
import { AnnouncementsRail } from '@/components/community/AnnouncementsRail';
import { Composer } from '@/components/community/Composer';
import { ComposerTrigger } from '@/components/community/ComposerTrigger';
import { PeopleRail } from '@/components/community/PeopleRail';
import { PostCard, type CommunityMessage } from '@/components/community/PostCard';
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
import { communityConfig } from '@/config';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';

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

  useInfiniteScroll({ target: sentinel, onIntersect: loadMore, enabled: !loading && hasMore, rootMargin: '800px' });

  function onPosted(message: CommunityMessage) {
    setMessages((current) => [message, ...current]);
    latestSeenAt.current = message.createdAt;
    setUnreadCount(0);
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
          {user && (
            <ComposerTrigger
              userName={user.name}
              userImage={user.profileImage ?? null}
              onOpen={() => setComposerOpen(true)}
            />
          )}

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
                    onDelete={remove}
                  />
                ))}
              </ul>

              <div ref={sentinel} className="py-6 text-center text-sm text-slate-400">
                {loadingMore ? strings.community.loadingOlder : !hasMore ? strings.community.endOfFeed : null}
              </div>
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
    </PageContainer>
  );
}
