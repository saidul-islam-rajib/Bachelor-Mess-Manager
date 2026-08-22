import { useEffect, useState } from 'react';
import { Avatar, Button, useConfirm } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { timeAgo } from '@/components/InvitationsProvider';
import { toLetConfig } from '@/config';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import type { ToLetCommentView } from '@/lib/tolet';

export function ToLetComments({ listingId, canModerate }: { listingId: string; canModerate: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useCurrentUser();
  const [comments, setComments] = useState<ToLetCommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api
      .get<{ comments: ToLetCommentView[] }>(`/api/tolet/${listingId}/comments`)
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
  }, [listingId]);

  async function submit() {
    const value = text.trim();
    if (!value || posting) return;

    setPosting(true);
    try {
      const data = await api.post<{ comment: ToLetCommentView }>(`/api/tolet/${listingId}/comments`, { text: value });
      setComments((current) => [...current, data.comment]);
      setText('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPosting(false);
    }
  }

  async function remove(comment: ToLetCommentView) {
    const accepted = await confirm({
      title: strings.toLet.comments.deleteConfirmTitle,
      message: strings.toLet.comments.deleteConfirmBody,
      confirmLabel: strings.common.delete,
      destructive: true
    });
    if (!accepted) return;

    try {
      await api.delete(`/api/tolet/${listingId}/comments/${comment.id}`);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      toast.success(strings.toLet.comments.deleted);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{strings.toLet.comments.title}</h2>

      {loading ? (
        <p className="text-sm text-slate-400">{strings.common.loading}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-400">{strings.toLet.comments.empty}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar name={comment.userName} image={comment.userImage} size="sm" />
              <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{comment.userName}</p>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(comment.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700">{comment.text}</p>
              </div>
              {(canModerate || comment.userId === user?.id) && (
                <button
                  type="button"
                  onClick={() => void remove(comment)}
                  aria-label={strings.toLet.comments.deleteAction}
                  title={strings.toLet.comments.deleteAction}
                  className="shrink-0 self-start rounded-full p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-red-600"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
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
              maxLength={toLetConfig.commentMaxLength}
              placeholder={strings.toLet.comments.placeholder}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={() => void submit()} disabled={!text.trim()} loading={posting}>
                {posting ? strings.toLet.comments.submitting : strings.toLet.comments.submit}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ToLetComments;
