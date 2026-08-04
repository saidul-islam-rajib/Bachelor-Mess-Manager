import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MentionInput, MentionText, type Member } from '@/components/MentionInput';
import { useCommunity } from '@/components/CommunityProvider';
import { timeAgo } from '@/components/InvitationsProvider';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import {
  Alert,
  Avatar,
  Badge,
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
import { encodeMentions } from '@/lib/mentions';

type CommunityMessage = {
  id: string;
  type: string;
  system: boolean;
  authorId: string | null;
  authorName: string;
  authorImage: string | null;
  title: string | null;
  text: string;
  pinned: boolean;
  createdAt: string;
};

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
};

const TYPE_TONES: Record<string, string> = {
  WELCOME: 'border-emerald-200 bg-emerald-50',
  ANNOUNCEMENT: 'border-amber-200 bg-amber-50',
  SYSTEM: 'border-slate-200 bg-slate-50'
};

function mergeById(current: CommunityMessage[], incoming: CommunityMessage[]): CommunityMessage[] {
  if (incoming.length === 0) return current;

  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);

  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function MessageBubble({
  message,
  members,
  mentionNames,
  isOwn,
  canDelete,
  onDelete
}: {
  message: CommunityMessage;
  members: Member[];
  mentionNames: Record<string, string>;
  isOwn: boolean;
  canDelete: boolean;
  onDelete: (message: CommunityMessage) => void;
}) {
  const typeLabel = strings.community.types[message.type as keyof typeof strings.community.types];

  return (
    <li
      className={`rounded-2xl border px-4 py-3 ${
        message.system ? TYPE_TONES[message.type] ?? TYPE_TONES.SYSTEM : 'border-slate-100 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar
          name={message.system ? appConfig.name : message.authorName}
          image={message.system ? null : message.authorImage}
          size="sm"
          muted={message.system}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-900">{message.authorName}</span>
            {isOwn && <span className="text-xs text-green-600">{strings.common.you}</span>}
            {message.system && typeLabel && (
              <Badge tone={message.type === 'ANNOUNCEMENT' ? 'warning' : 'success'}>{typeLabel}</Badge>
            )}
            <span className="text-xs text-slate-400">{timeAgo(message.createdAt)}</span>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(message)}
                aria-label={strings.community.deleteAction}
                title={strings.community.deleteAction}
                className="ml-auto rounded-md p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            )}
          </div>

          {message.title && <p className="mt-1 text-sm font-semibold text-slate-900">{message.title}</p>}

          <MentionText
            text={message.text}
            members={members}
            mentionNames={mentionNames}
            className="mt-1 hyphens-auto whitespace-pre-wrap break-words text-justify text-sm text-slate-700"
          />
        </div>
      </div>
    </li>
  );
}

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

  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [posting, setPosting] = useState(false);
  const [text, setText] = useState('');

  const bottom = useRef<HTMLDivElement>(null);
  const newestAt = useRef<string | null>(null);

  const rememberNewest = useCallback((list: CommunityMessage[]) => {
    const last = list[list.length - 1];
    if (last && (!newestAt.current || last.createdAt > newestAt.current)) {
      newestAt.current = last.createdAt;
    }
  }, []);

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
      rememberNewest(data.messages);
    } catch (error) {
      toast.error(errorMessage(error, strings.errors.loadFailed(strings.community.title)));
    } finally {
      setLoading(false);
    }
  }, [rememberNewest, toast]);

  useEffect(() => {
    if (user) load();
  }, [load, user]);

  const pull = useCallback(async () => {
    if (!user || !newestAt.current) return;

    try {
      const data = await api.get<FeedResponse>('/api/community/messages', {
        query: { after: newestAt.current }
      });
      if (data.messages.length === 0) return;

      setMessages((current) => mergeById(current, data.messages));
      setMentionNames((current) => ({ ...current, ...data.mentionNames }));
      rememberNewest(data.messages);
    } catch {
      return;
    }
  }, [rememberNewest, user]);

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

  useEffect(() => {
    if (!user || loading) return;
    markRead();
  }, [loading, markRead, messages.length, user]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;

    setLoadingOlder(true);
    try {
      const data = await api.get<FeedResponse>('/api/community/messages', {
        query: { before: oldest.createdAt }
      });
      setMessages((current) => mergeById(data.messages, current));
      setMentionNames((current) => ({ ...current, ...data.mentionNames }));
      setHasMore(data.hasMore);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function post() {
    const value = text.trim();
    if (!value || posting) return;

    setPosting(true);
    try {
      const data = await api.post<{ message: CommunityMessage }>('/api/community/messages', {
        text: encodeMentions(value, members)
      });
      setMessages((current) => mergeById(current, [data.message]));
      rememberNewest([data.message]);
      setText('');
      setUnreadCount(0);
      toast.success(strings.community.posted);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPosting(false);
    }
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
      <PageHeader title={strings.community.title} description={strings.community.subtitle(appConfig.name)} />

      {pinned.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={strings.community.pinned} />
          <ul className="mt-3 space-y-2">
            {pinned.map((message) => (
              <li key={message.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                {message.title && <p className="text-sm font-semibold text-slate-900">{message.title}</p>}
                <MentionText
                  text={message.text}
                  members={members}
                  mentionNames={mentionNames}
                  className="mt-0.5 hyphens-auto whitespace-pre-wrap break-words text-justify text-sm text-slate-700"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        {loading ? (
          <LoadingCard />
        ) : messages.length === 0 ? (
          <EmptyState title={strings.community.empty} />
        ) : (
          <>
            {hasMore && (
              <div className="mb-3 flex justify-center">
                <Button size="sm" variant="secondary" onClick={loadOlder} loading={loadingOlder}>
                  {strings.community.loadOlder}
                </Button>
              </div>
            )}

            <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  members={members}
                  mentionNames={mentionNames}
                  isOwn={message.authorId === user.id}
                  canDelete={canDelete(message)}
                  onDelete={remove}
                />
              ))}
              <div ref={bottom} />
            </ul>
          </>
        )}

        <form
          className="mt-4 border-t border-slate-100 pt-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void post();
          }}
        >
          <MentionInput
            value={text}
            onChange={setText}
            members={members}
            rows={3}
            maxLength={maxLength}
            allowEveryone={canMentionEveryone}
            hint={canMentionEveryone ? strings.comments.mentionHint : strings.community.mentionHint}
            placeholder={strings.community.placeholder}
            onSubmit={() => void post()}
          />
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={!text.trim()} loading={posting}>
              {strings.community.send}
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
