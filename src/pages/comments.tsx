import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useGroupMonth } from '@/components/GroupMonthControls';

type Comment = {
  id: string;
  text: string;
  replyText: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  repliedAt: string | null;
  canDelete: boolean;
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
  const [canReply, setCanReply] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/comments`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not load comments.');
      setComments(body.comments || []);
      setCanReply(Boolean(body.canReply));
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

  async function post(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPosting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
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

  async function sendReply(id: string) {
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not reply.');
      toast.success('Reply sent.');
      setReplyFor(null);
      setReplyText('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(id: string) {
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

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Comments</h1>
        <p className="mt-1 text-slate-600">
          Ask the group something or raise an issue. Once posted, a comment can&apos;t be edited — only the supervisor
          can remove it.
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
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5"
              >
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
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                rows={3}
                maxLength={1000}
                placeholder="Anything the group should know?"
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={posting}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
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
                {comments.map((c) => (
                  <li key={c.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {c.authorName}
                          {c.authorId === currentUserId && (
                            <span className="ml-1 text-xs font-normal text-green-600">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">{when(c.createdAt)}</p>
                      </div>
                      {c.canDelete && (
                        <button
                          onClick={() => remove(c.id)}
                          className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-slate-700">{c.text}</p>

                    {c.replyText ? (
                      <div className="mt-3 rounded-xl border-l-4 border-slate-900 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Supervisor reply
                          {c.repliedAt ? ` · ${when(c.repliedAt)}` : ''}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.replyText}</p>
                      </div>
                    ) : canReply ? (
                      replyFor === c.id ? (
                        <div className="mt-3">
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={2}
                            maxLength={1000}
                            placeholder="Write a reply"
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => sendReply(c.id)}
                              className="rounded-full bg-slate-900 px-4 py-1.5 text-xs text-white hover:bg-slate-700"
                            >
                              Send reply
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
                          onClick={() => {
                            setReplyFor(c.id);
                            setReplyText('');
                          }}
                          className="mt-3 rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          Reply
                        </button>
                      )
                    ) : null}
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

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm text-slate-600 sm:p-6">{children}</div>;
}
