import { useState } from 'react';
import { PhotoLightbox } from '@/components/ui';
import { strings } from '@/lib/i18n';

const MAX_VISIBLE = 4;

const LAYOUT: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 grid-rows-2',
  4: 'grid-cols-2 grid-rows-2'
};

function cellClassName(count: number, index: number): string {
  if (count === 3 && index === 0) return 'row-span-2';
  return '';
}

function aspectClassName(count: number, index: number): string {
  if (count === 1) return 'aspect-[16/10]';
  if (count === 3 && index === 0) return 'h-full';
  return 'aspect-square';
}

export function ImageGrid({ images, authorName }: { images: string[]; authorName: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const visible = images.slice(0, MAX_VISIBLE);
  const hiddenCount = images.length - visible.length;

  return (
    <>
      <div className={`grid gap-px bg-slate-100 ${LAYOUT[visible.length] ?? 'grid-cols-2'}`}>
        {visible.map((src, index) => {
          const isLastTile = hiddenCount > 0 && index === visible.length - 1;
          return (
            <button
              key={src}
              type="button"
              onClick={() => setOpenIndex(index)}
              className={`relative block w-full cursor-zoom-in bg-slate-100 ${cellClassName(visible.length, index)}`}
            >
              <img
                src={src}
                alt={strings.community.postImageAlt(authorName, index)}
                className={`h-full w-full object-cover ${aspectClassName(visible.length, index)}`}
              />
              {isLastTile && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xl font-semibold text-white">
                  +{hiddenCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {openIndex !== null && (
        <PhotoLightbox
          images={images}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          altFor={(index) => strings.community.postImageAlt(authorName, index)}
        />
      )}
    </>
  );
}

export default ImageGrid;
