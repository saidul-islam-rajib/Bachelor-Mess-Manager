import { useEffect, useState } from 'react';
import { Avatar, Button, useConfirm } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { timeAgo } from '@/components/InvitationsProvider';
import { communityConfig } from '@/config';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import type { CommunityCommentReplyView, CommunityCommentView } from '@/lib/community';

export function CommunityComments({
  messageId,
  canModerate,
  onCountChange
}: {
  messageId: string;
  canModerate: boolean;
  onCountChange?: (count: number) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useCurrentUser();
  const [comments, setComments] = useState<CommunityCommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api
      .get<{ comments: CommunityCommentView[] }>(`/api/community/messages/${messageId}/comments`)
      .then((data) => {
        if (!cancelled) setComments(data.comments);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [messageId]);

  async function submit() {
    const value = text.trim();
    if (!value || posting) return;

    setPosting(true);
    try {
      const data = await api.post<{ comment: CommunityCommentView }>(`/api/community/messages/${messageId}/comments`, {
        text: value
      });
      setComments((current) => {
        const next = [...current, data.comment];
        onCountChange?.(next.length);
        return next;
      });
      setText('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPosting(false);
    }
  }

  async function sendReply(commentId: string) {
    const value = replyText.trim();
    if (!value || replying) return;

    setReplying(true);
    try {
      const data = await api.post<{ reply: CommunityCommentReplyView }>(
        `/api/community/messages/${messageId}/comments/${commentId}/replies`,
        { text: value }
      );
      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId ? { ...comment, replies: [...comment.replies, data.reply] } : comment
        )
      );
      setReplyFor(null);
      setReplyText('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setReplying(false);
    }
  }

  async function removeComment(comment: CommunityCommentView) {
    const accepted = await confirm({
      title: strings.community.comments.deleteConfirmTitle,
      message: strings.community.comments.deleteConfirmBody,
      confirmLabel: strings.common.delete,
      destructive: true
    });
    if (!accepted) return;

    try {
      await api.delete(`/api/community/messages/${messageId}/comments/${comment.id}`);
      setComments((current) => {
        const next = current.filter((item) => item.id !== comment.id);
        onCountChange?.(next.length);
        return next;
      });
      toast.success(strings.community.comments.deleted);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function removeReply(comment: CommunityCommentView, replyId: string) {
    const accepted = await confirm({
      title: strings.community.comments.deleteReplyConfirmTitle,
      confirmLabel: strings.common.delete,
      destructive: true
    });
    if (!accepted) return;

    try {
      await api.delete(`/api/community/messages/${messageId}/comments/${comment.id}/replies/${replyId}`);
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id ? { ...item, replies: item.replies.filter((reply) => reply.id !== replyId) } : item
        )
      );
      toast.success(strings.community.comments.replyDeleted);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">{strings.common.loading}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">{strings.community.comments.empty}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id}>
              <div className="flex gap-3">
                <Avatar name={comment.userName} image={comment.userImage} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{comment.userName}</p>
                      <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300">{comment.text}</p>
                  </div>

                  <div className="mt-1 flex items-center gap-3 px-1">
                    {user && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyFor(comment.id);
                          setReplyText('');
                        }}
                        className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700"
                      >
                        {strings.community.comments.reply}
                      </button>
                    )}
                    {(canModerate || comment.userId === user?.id) && (
                      <button
                        type="button"
                        onClick={() => void removeComment(comment)}
                        className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-red-600"
                      >
                        {strings.community.comments.deleteComment}
                      </button>
                    )}
                  </div>

                  {comment.replies.length > 0 && (
                    <ul className="mt-2 space-y-2 border-l-2 border-slate-100 dark:border-slate-700 pl-4">
                      {comment.replies.map((reply) => (
                        <li key={reply.id} className="flex gap-2.5">
                          <Avatar name={reply.userName} image={reply.userImage} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 px-3.5 py-2">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{reply.userName}</p>
                                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{timeAgo(reply.createdAt)}</span>
                              </div>
                              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300">{reply.text}</p>
                            </div>
                            {(canModerate || reply.userId === user?.id) && (
                              <button
                                type="button"
                                onClick={() => void removeReply(comment, reply.id)}
                                className="mt-1 px-1 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-red-600"
                              >
                                {strings.community.comments.deleteReply}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {replyFor === comment.id && (
                    <div className="mt-2 flex items-start gap-2">
                      <textarea
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        rows={1}
                        placeholder={strings.community.comments.replyPlaceholder}
                        className="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm outline-none transition focus:border-brand-500 focus:bg-white dark:focus:bg-slate-800"
                      />
                      <Button
                        size="sm"
                        onClick={() => void sendReply(comment.id)}
                        disabled={!replyText.trim()}
                        loading={replying}
                      >
                        {replying ? strings.community.comments.sending : strings.community.comments.sendReply}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {user && (
        <div className="flex items-start gap-3">
          <Avatar name={user.name} image={user.profileImage} size="sm" />
          <div className="min-w-0 flex-1">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={2}
              maxLength={communityConfig.maxMessageLength}
              placeholder={strings.community.comments.placeholder}
              className="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white dark:focus:bg-slate-800"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={() => void submit()} disabled={!text.trim()} loading={posting}>
                {posting ? strings.community.comments.submitting : strings.community.comments.submit}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityComments;
