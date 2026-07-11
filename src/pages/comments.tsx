import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useGroupMonth } from '@/components/GroupMonthControls';
import { MentionInput, MentionText, type Member } from '@/components/MentionInput';
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

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function CommentsPage() {
  const toast = useToast();
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
      const res = await fetch(`/api/groups/${groupId}/comments`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not load comments.');
      setComments(body.comments || []);
      setMembers(body.members || []);
      setMentionNames(body.mentionNames || {});
      setIsSupervisor(Boolean(body.isSupervisor));
      setCurrentUserId(body.currentUserId || '');
    } catch (err) {
      toast.error((err as Error).message);
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
      const res = await fetch(`/api/groups/${groupId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: encodeMentions(text, members) })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not post.');
      toast.success('Comment posted.');
      setText('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPosting(false);
    }
  }

  async function sendReply(commentId: string) {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/comments/${commentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: encodeMentions(replyText, members) })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not reply.');
      toast.success('Reply posted.');
      setReplyFor(null);
      setReplyText('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReplying(false);
    }
  }

  async function removeComment(id: string) {
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not delete.');
      toast.success('Comment deleted.');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function removeReply(id: string) {
    try {
      const res = await fetch(`/api/comment-replies/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not delete.');
      toast.success('Reply deleted.');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function openReply(comment: Comment) {
    setReplyFor(comment.id);
    setReplyText(comment.authorId === currentUserId ? '' : `@${comment.authorName} `);
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Comments</h1>
        <p className="mt-1 text-slate-600">
          Anyone in the group can post and reply. Mention someone with @. Once posted, a comment can&apos;t be edited —
          only the supervisor can remove it.
        </p>
      </div>

      {loadingGroups ? (
        <Card>Loading...</Card>
      ) : groups.length === 0 ? (
        <Card>You&apos;re not part of any group yet.</Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Group</span>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="app-select mt-1">
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Say something</h2>
            <form className="mt-3" onSubmit={post}>
              <MentionInput
                value={text}
                onChange={setText}
                members={members}
                placeholder="Anything the group should know?"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={posting || !text.trim()}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  {posting ? 'Posting...' : 'Post comment'}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">
              Thread <span className="text-sm font-normal text-slate-500">({comments.length})</span>
            </h2>

            {loading ? (
              <p className="mt-4 text-slate-500">Loading...</p>
            ) : comments.length === 0 ? (
              <p className="mt-4 text-slate-500">No comments yet. Be the first.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {comment.authorName}
                          {comment.authorId === currentUserId && (
                            <span className="ml-1 text-xs font-normal text-green-600">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">{when(comment.createdAt)}</p>
                      </div>
                      {isSupervisor && (
                        <DeleteButton onClick={() => removeComment(comment.id)} label="Delete comment" />
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
                                <p className="text-xs font-medium text-slate-600">
                                  {reply.authorName}
                                  {reply.authorId === currentUserId && (
                                    <span className="ml-1 text-green-600">(you)</span>
                                  )}
                                  {reply.isSupervisor && (
                                    <span className="ml-1.5 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                      Supervisor
                                    </span>
                                  )}
                                  <span className="ml-2 font-normal text-slate-400">{when(reply.createdAt)}</span>
                                </p>
                                <div className="mt-0.5 text-sm">
                                  <MentionText text={reply.text} members={members} mentionNames={mentionNames} />
                                </div>
                              </div>
                              {isSupervisor && (
                                <DeleteButton onClick={() => removeReply(reply.id)} label="Delete reply" />
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
                          placeholder="Write a reply"
                          onSubmit={() => sendReply(comment.id)}
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => sendReply(comment.id)}
                            disabled={replying || !replyText.trim()}
                            className="rounded-full bg-slate-900 px-4 py-1.5 text-xs text-white hover:bg-slate-700 disabled:opacity-40"
                          >
                            {replying ? 'Sending...' : 'Send reply'}
                          </button>
                          <button
                            onClick={() => {
                              setReplyFor(null);
                              setReplyText('');
                            }}
                            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => openReply(comment)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 17l-5-5 5-5" />
                          <path d="M4 12h11a5 5 0 0 1 5 5v2" />
                        </svg>
                        Reply
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 rounded-md p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
      </svg>
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm sm:p-6">{children}</div>;
}
