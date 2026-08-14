import { useCallback, useEffect, useRef, useState } from 'react';
import { Composer } from '@/components/community/Composer';
import { PostCard, type CommunityMessage } from '@/components/community/PostCard';
import { useInfiniteScroll } from '@/components/community/useInfiniteScroll';
import type { Member } from '@/components/MentionInput';
import { useCommunity } from '@/components/CommunityProvider';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import {
  ActionLink,
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingCard,
  PageContainer,
  PageHeader,
  useConfirm
} from '@/components/ui';
import { appConfig, communityConfig } from '@/config';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import { commentsAnchorPath } from '@/lib/routes';

type FeedResponse = {
  messages: CommunityMessage[];
  pinned: CommunityMessage[];
  mentionNames: Record<string, string>;
  hasMore: boolean;
  members?: Member[];
  unreadCount: number;
  currentUserId: string;
  canMentionEveryone: boolean;
  canModerate: boolean;
  maxLength: number;
  maxImagesPerPost: number;
};

export default function CommunityPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useCurrentUser();
  const { markRead, setUnreadCount } = useCommunity();

  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [pinned, setPinned] = useState<CommunityMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [mentionNames, setMentionNames] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(false);
  const [canMentionEveryone, setCanMentionEveryone] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const [maxLength, setMaxLength] = useState(communityConfig.maxMessageLength);
  const [maxImagesPerPost, setMaxImagesPerPost] = useState(communityConfig.maxImagesPerPost);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newPostsPending, setNewPostsPending] = useState(0);

  const latestSeenAt = useRef<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<FeedResponse>('/api/community/messages');
      setMessages(data.messages);
      setPinned(data.pinned);
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
      toast.error(errorMessage(error, strings.errors.loadFailed(strings.community.title)));
    } finally {
      setLoading(false);
    }
  }, [markRead, toast]);

  useEffect(() => {
    if (user) load();
  }, [load, user]);

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

  useInfiniteScroll({ target: sentinel, onIntersect: loadMore, enabled: !loading && hasMore });

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
      setPinned((current) => current.filter((item) => item.id !== message.id));
      toast.success(strings.community.deleted);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (!user) {
    return (
      <PageContainer>
        <PageHeader title={strings.community.title} />
        <Alert tone="warning">{strings.community.signedOut}</Alert>
      </PageContainer>
    );
  }

  const canDelete = (message: CommunityMessage) =>
    canModerate || (!message.system && message.authorId === user.id);

  return (
    <PageContainer>
      <PageHeader
        title={strings.community.title}
        description={strings.community.subtitle(appConfig.name)}
        action={<ActionLink href={commentsAnchorPath()}>{strings.community.elsewhereLink}</ActionLink>}
      />

      <Composer
        members={members}
        maxLength={maxLength}
        maxImagesPerPost={maxImagesPerPost}
        allowEveryone={canMentionEveryone}
        onPosted={onPosted}
      />

      {newPostsPending > 0 && (
        <div className="mt-4 flex justify-center">
          <Button size="sm" variant="secondary" onClick={load}>
            {strings.community.newMessages(newPostsPending)} · {strings.community.jumpToLatest}
          </Button>
        </div>
      )}

      {pinned.length > 0 && (
        <Card className="mt-4">
          <CardHeader title={strings.community.pinned} />
          <ul className="mt-3 space-y-2">
            {pinned.map((message) => (
              <PostCard
                key={message.id}
                message={message}
                members={members}
                mentionNames={mentionNames}
                isOwn={message.authorId === user.id}
                canDelete={canDelete(message)}
                onDelete={remove}
              />
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-4">
        {loading ? (
          <LoadingCard />
        ) : messages.length === 0 ? (
          <EmptyState title={strings.community.empty} />
        ) : (
          <>
            <ul className="space-y-2">
              {messages.map((message) => (
                <PostCard
                  key={message.id}
                  message={message}
                  members={members}
                  mentionNames={mentionNames}
                  isOwn={message.authorId === user.id}
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
    </PageContainer>
  );
}
