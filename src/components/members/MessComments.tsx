import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { MentionInput, MentionText, type Member } from '@/components/MentionInput';
import { ImageGrid } from '@/components/community/ImageGrid';
import { Avatar, Badge, Button, EmptyState, Modal, SkeletonRows, useConfirm } from '@/components/ui';
import { api, errorMessage } from '@/lib/api-client';
import { communityConfig, uploadConfig } from '@/config';
import { formatBytes, formatDateTime } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { encodeMentions } from '@/lib/mentions';
import { ACCEPTED_IMAGE_MIMES } from '@/lib/uploads.client';

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
  images: string[];
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(strings.uploads.imageUnreadable));
    reader.readAsDataURL(file);
  });
}

export default function MessComments({ groupId }: { groupId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useCurrentUser();

  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [mentionNames, setMentionNames] = useState<Record<string, string>>({});
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);

  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [maxImageBytes, setMaxImageBytes] = useState(uploadConfig.maxImageBytes);
  const [posting, setPosting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    let cancelled = false;

    fetch('/api/settings')
      .then((res) => res.json())
      .then((body) => {
        const configured = Number(body?.settings?.maxProfileImageBytes);
        if (!cancelled && Number.isFinite(configured) && configured > 0) setMaxImageBytes(configured);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const room = communityConfig.maxImagesPerPost - images.length;
    if (room <= 0) {
      toast.error(strings.comments.tooManyImages(communityConfig.maxImagesPerPost));
      return;
    }

    const accepted: File[] = [];
    for (const file of files.slice(0, room)) {
      if (!ACCEPTED_IMAGE_MIMES.includes(file.type)) {
        toast.error(strings.uploads.imageWrongType);
        continue;
      }
      if (file.size > maxImageBytes) {
        toast.error(strings.uploads.imageTooLarge(formatBytes(maxImageBytes)));
        continue;
      }
      accepted.push(file);
    }
    if (files.length > room) {
      toast.error(strings.comments.tooManyImages(communityConfig.maxImagesPerPost));
    }

    try {
      const dataUrls = await Promise.all(accepted.map(readAsDataUrl));
      setImages((current) => [...current, ...dataUrls]);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, i) => i !== index));
  }

  async function post() {
    const value = text.trim();
    if (!value && images.length === 0) return;

    setPosting(true);
    try {
      await api.post(`/api/groups/${groupId}/comments`, { text: encodeMentions(value, members), images });
      toast.success(strings.comments.posted);
      setText('');
      setImages([]);
      setComposerOpen(false);
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
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Avatar name={user?.name ?? ''} image={user?.profileImage ?? null} size="md" />
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-left text-sm text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          {strings.comments.placeholder}
        </button>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          aria-label={strings.comments.addPhotos}
          title={strings.comments.addPhotos}
          className="shrink-0 rounded-full p-2.5 text-emerald-600 transition-colors hover:bg-emerald-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m21 15-4.5-4.5a2 2 0 0 0-2.83 0L5 19" />
          </svg>
        </button>
      </div>

      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title={strings.comments.composerTitle}
        size="lg"
        footer={
          <Button onClick={() => void post()} disabled={!text.trim() && images.length === 0} loading={posting}>
            {posting ? strings.comments.posting : strings.comments.postComment}
          </Button>
        }
      >
        <MentionInput value={text} onChange={setText} members={members} rows={4} placeholder={strings.comments.placeholder} onSubmit={() => void post()} />

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_IMAGE_MIMES.join(',')}
            multiple
            className="hidden"
            onChange={addFiles}
          />

          {images.map((src, index) => (
            <div key={src} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(index)}
                aria-label={strings.comments.imageRemove}
                title={strings.comments.imageRemove}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white transition-colors hover:bg-red-600"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {images.length < communityConfig.maxImagesPerPost && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label={strings.comments.addPhotos}
              title={strings.comments.addPhotos}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-500"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          )}
        </div>
      </Modal>

      <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {strings.comments.threadHeading}
          <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">({comments.length})</span>
        </h3>

        {loading ? (
          <div className="mt-4" role="status" aria-busy="true" aria-label={strings.common.loading}>
            <SkeletonRows rows={3} />
          </div>
        ) : comments.length === 0 ? (
          <EmptyState className="mt-4" title={strings.comments.empty} />
        ) : (
          <ul className="mt-4 space-y-4">
            {comments.map((comment) => (
              <li key={comment.id} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {comment.authorName}
                        {comment.authorId === currentUserId && (
                          <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">{strings.common.you}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(comment.createdAt)}</p>
                    </div>
                    {isSupervisor && (
                      <DeleteButton onClick={() => removeComment(comment.id)} label={strings.comments.deleteComment} />
                    )}
                  </div>

                  {comment.text && (
                    <div className="mt-2">
                      <MentionText text={comment.text} members={members} mentionNames={mentionNames} />
                    </div>
                  )}
                </div>

                {comment.images.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-700">
                    <ImageGrid images={comment.images} authorName={comment.authorName} />
                  </div>
                )}

                <div className="p-4 pt-3">
                  {comment.replies.length > 0 && (
                    <ul className="space-y-2 border-l-2 border-slate-100 dark:border-slate-700 pl-4">
                      {comment.replies.map((reply) => (
                        <li key={reply.id} className="rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                                <span>
                                  {reply.authorName}
                                  {reply.authorId === currentUserId && (
                                    <span className="ml-1 text-green-600 dark:text-green-400">{strings.common.you}</span>
                                  )}
                                </span>
                                {reply.isSupervisor && <Badge tone="info">{strings.common.supervisor}</Badge>}
                                <span className="font-normal text-slate-400 dark:text-slate-500">{formatDateTime(reply.createdAt)}</span>
                              </p>
                              <div className="mt-0.5 text-sm">
                                <MentionText text={reply.text} members={members} mentionNames={mentionNames} />
                              </div>
                            </div>
                            {isSupervisor && (
                              <DeleteButton onClick={() => removeReply(reply.id)} label={strings.comments.deleteReply} />
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
                        <Button
                          size="sm"
                          disabled={!replyText.trim()}
                          loading={replying}
                          onClick={() => sendReply(comment.id)}
                        >
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="-my-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
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
