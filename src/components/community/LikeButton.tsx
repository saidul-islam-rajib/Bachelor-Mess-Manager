import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';

export function LikeButton({
  messageId,
  liked,
  count,
  compact = false,
  onChange
}: {
  messageId: string;
  liked: boolean;
  count: number;
  compact?: boolean;
  onChange: (liked: boolean, count: number) => void;
}) {
  const toast = useToast();
  const { user } = useCurrentUser();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!user || busy) return;
    setBusy(true);

    const previous = { liked, count };
    onChange(!liked, liked ? Math.max(0, count - 1) : count + 1);

    try {
      const result = await api.post<{ liked: boolean; likeCount: number }>(`/api/community/messages/${messageId}/like`);
      onChange(result.liked, result.likeCount);
    } catch (error) {
      onChange(previous.liked, previous.count);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle();
      }}
      disabled={!user || busy}
      aria-pressed={liked}
      aria-label={liked ? strings.community.unlike : strings.community.like}
      title={liked ? strings.community.unlike : strings.community.like}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      } ${liked ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
    >
      <svg
        width={compact ? 14 : 16}
        height={compact ? 14 : 16}
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
      {count}
    </button>
  );
}

export default LikeButton;
