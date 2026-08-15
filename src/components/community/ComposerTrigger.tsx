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
      <div className="flex items-center gap-2">
        <Avatar name={userName} image={userImage} size="md" />
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm text-slate-500 transition-colors hover:bg-slate-100"
        >
          {strings.community.placeholder}
        </button>
        <button
          type="button"
          onClick={onOpen}
          aria-label={strings.community.addPhotos}
          title={strings.community.addPhotos}
          className="shrink-0 rounded-full p-2.5 text-emerald-600 transition-colors hover:bg-emerald-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m21 15-4.5-4.5a2 2 0 0 0-2.83 0L5 19" />
          </svg>
        </button>
      </div>
    </Card>
  );
}

export default ComposerTrigger;
