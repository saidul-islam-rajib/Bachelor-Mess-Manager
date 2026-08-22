import { useEffect } from 'react';
import { strings } from '@/lib/i18n';

export type PhotoLightboxProps = {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  altFor: (index: number) => string;
};

export function PhotoLightbox({ images, index, onIndexChange, onClose, altFor }: PhotoLightboxProps) {
  const count = images.length;
  const safeIndex = Math.min(Math.max(index, 0), Math.max(count - 1, 0));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft' && count > 1) onIndexChange((safeIndex - 1 + count) % count);
      else if (event.key === 'ArrowRight' && count > 1) onIndexChange((safeIndex + 1) % count);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [safeIndex, count, onClose, onIndexChange]);

  if (count === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        aria-label={strings.common.close}
        className="absolute right-3 top-3 z-10 rounded-full p-2.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:right-5 sm:top-5"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-14 sm:px-16">
        {count > 1 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((safeIndex - 1 + count) % count);
            }}
            aria-label={strings.common.pager.previous}
            className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:left-4"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <img
          src={images[safeIndex]}
          alt={altFor(safeIndex)}
          onClick={(event) => event.stopPropagation()}
          className="max-h-[82vh] max-w-[92vw] cursor-default select-none object-contain sm:max-w-[80vw]"
        />

        {count > 1 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((safeIndex + 1) % count);
            }}
            aria-label={strings.common.pager.next}
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:right-4"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-4" onClick={(event) => event.stopPropagation()}>
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => onIndexChange(i)}
              aria-label={altFor(i)}
              aria-pressed={i === safeIndex}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity ${
                i === safeIndex ? 'border-white' : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PhotoLightbox;
