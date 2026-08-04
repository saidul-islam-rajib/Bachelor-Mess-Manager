import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useGroupMonth } from '@/components/GroupMonthControls';
import { MentionInput, MentionText, type Member } from '@/components/MentionInput';
import {
  ActionLink,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingCard,
  PageContainer,
  PageHeader,
  Select,
  SkeletonRows,
  useConfirm
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { ROUTES } from '@/lib/routes';
import { encodeMentions } from '@/lib/mentions';

type Reply = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  isSupervisor: boolean;
  createdAt: string;
};

type Comment = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  replies: Reply[];
};

type CommentsResponse = {
  comments?: Comment[];
  members?: Member[];
  mentionNames?: Record<string, string>;
  isSupervisor?: boolean;
  currentUserId?: string;
};

export default function CommentsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { groups, groupId, setGroupId, loadingGroups } = useGroupMonth();

  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [mentionNames, setMentionNames] = useState<Record<string, string>>({});
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const body = await api.get<CommentsResponse>(`/api/groups/${groupId}/comments`);
      setComments(body.comments ?? []);
      setMembers(body.members ?? []);
      setMentionNames(body.mentionNames ?? {});
      setIsSupervisor(Boolean(body.isSupervisor));
      setCurrentUserId(body.currentUserId ?? '');
    } catch (err) {
      toast.error(errorMessage(err, strings.comments.loadFailed));
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      await api.post(`/api/groups/${groupId}/comments`, { text: encodeMentions(text, members) });
      toast.success(strings.comments.posted);
      setText('');
      await load();
    } catch (err) {
      toast.error(errorMessage(err, strings.comments.postFailed));
    } finally {
      setPosting(false);
    }
  }

  async function sendReply(commentId: string) {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await api.post(`/api/comments/${commentId}/replies`, { text: encodeMentions(replyText, members) });
      toast.success(strings.comments.replyPosted);
      setReplyFor(null);
      setReplyText('');
      await load();
    } catch (err) {
      toast.error(errorMessage(err, strings.comments.replyFailed));
    } finally {
      setReplying(false);
    }
  }

  async function removeComment(id: string) {
    const ok = await confirm({ title: strings.comments.deleteComment, destructive: true });
    if (!ok) return;

    try {
      await api.delete(`/api/comments/${id}`);
      toast.success(strings.comments.commentDeleted);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, strings.comments.deleteFailed));
    }
  }

  async function removeReply(id: string) {
    const ok = await confirm({ title: strings.comments.deleteReply, destructive: true });
    if (!ok) return;

    try {
      await api.delete(`/api/comment-replies/${id}`);
      toast.success(strings.comments.replyDeleted);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, strings.comments.deleteFailed));
    }
  }

  function openReply(comment: Comment) {
    setReplyFor(comment.id);
    setReplyText(comment.authorId === currentUserId ? '' : `@${comment.authorName} `);
  }

  return (
    <PageContainer>
      <PageHeader
        title={strings.comments.title}
        description={strings.comments.subtitle}
        action={<ActionLink href={ROUTES.community}>{strings.comments.elsewhereLink}</ActionLink>}
      />

      {loadingGroups ? (
        <LoadingCard />
      ) : groups.length === 0 ? (
        <EmptyState title={strings.comments.noGroup} />
      ) : (
        <div className="space-y-6">
          <Card>
            <Select
              compact
              label={strings.common.group}
              value={groupId}
              onChange={setGroupId}
              options={groups.map((group) => ({ value: group.id, label: group.name }))}
            />
          </Card>

          <Card>
            <CardHeader title={strings.comments.composeHeading} />
            <form className="mt-3" onSubmit={post}>
              <MentionInput
                value={text}
                onChange={setText}
                members={members}
                placeholder={strings.comments.placeholder}
              />
              <div className="mt-3 flex justify-end">
                <Button type="submit" disabled={!text.trim()} loading={posting}>
                  {posting ? strings.comments.posting : strings.comments.postComment}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {strings.comments.threadHeading}
                  <span className="text-sm font-normal text-slate-500">({comments.length})</span>
                </span>
              }
            />

            {loading ? (
              <div className="mt-4" role="status" aria-busy="true" aria-label={strings.common.loading}>
                <SkeletonRows rows={3} />
              </div>
            ) : comments.length === 0 ? (
              <EmptyState className="mt-4" title={strings.comments.empty} />
            ) : (
              <ul className="mt-4 space-y-4">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {comment.authorName}
                          {comment.authorId === currentUserId && (
                            <span className="ml-1 text-xs font-normal text-green-600">{strings.common.you}</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">{formatDateTime(comment.createdAt)}</p>
                      </div>
                      {isSupervisor && (
                        <DeleteButton
                          onClick={() => removeComment(comment.id)}
                          label={strings.comments.deleteComment}
                        />
                      )}
                    </div>

                    <div className="mt-2">
                      <MentionText text={comment.text} members={members} mentionNames={mentionNames} />
                    </div>

                    {comment.replies.length > 0 && (
                      <ul className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
                        {comment.replies.map((reply) => (
                          <li key={reply.id} className="rounded-xl bg-slate-50 px-3 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-600">
                                  <span>
                                    {reply.authorName}
                                    {reply.authorId === currentUserId && (
                                      <span className="ml-1 text-green-600">{strings.common.you}</span>
                                    )}
                                  </span>
                                  {reply.isSupervisor && <Badge tone="info">{strings.common.supervisor}</Badge>}
                                  <span className="font-normal text-slate-400">{formatDateTime(reply.createdAt)}</span>
                                </p>
                                <div className="mt-0.5 text-sm">
                                  <MentionText text={reply.text} members={members} mentionNames={mentionNames} />
                                </div>
                              </div>
                              {isSupervisor && (
                                <DeleteButton
                                  onClick={() => removeReply(reply.id)}
                                  label={strings.comments.deleteReply}
                                />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {replyFor === comment.id ? (
                      <div className="mt-3">
                        <MentionInput
                          value={replyText}
                          onChange={setReplyText}
                          members={members}
                          rows={2}
                          placeholder={strings.comments.replyPlaceholder}
                          onSubmit={() => sendReply(comment.id)}
                        />
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" disabled={!replyText.trim()} loading={replying} onClick={() => sendReply(comment.id)}>
                            {replying ? strings.comments.sending : strings.comments.sendReply}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setReplyFor(null);
                              setReplyText('');
                            }}
                          >
                            {strings.common.cancel}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="secondary" className="mt-3" onClick={() => openReply(comment)}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M9 17l-5-5 5-5" />
                          <path d="M4 12h11a5 5 0 0 1 5 5v2" />
                        </svg>
                        {strings.comments.reply}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 rounded-md p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
      </svg>
    </button>
  );
}
