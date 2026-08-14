import { Avatar, Card } from '@/components/ui';
import { strings } from '@/lib/i18n';

export function ComposerTrigger({
  userName,
  userImage,
  onOpen
}: {
  userName: string;
  userImage: string | null;
  onOpen: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <Avatar name={userName} image={userImage} size="md" />
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm text-slate-500 transition-colors hover:bg-slate-100"
        >
          {strings.community.placeholder}
        </button>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m21 15-4.5-4.5a2 2 0 0 0-2.83 0L5 19" />
          </svg>
          {strings.community.addPhotos}
        </button>
      </div>
    </Card>
  );
}

export default ComposerTrigger;
