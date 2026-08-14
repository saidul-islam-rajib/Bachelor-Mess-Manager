import { ImageViewer } from '@/components/ui';
import { strings } from '@/lib/i18n';

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
  if (images.length === 0) return null;

  return (
    <div className={`mt-2 grid gap-1 overflow-hidden rounded-2xl ${LAYOUT[images.length] ?? 'grid-cols-2'}`}>
      {images.map((src, index) => (
        <ImageViewer
          key={src}
          src={src}
          alt={strings.community.postImageAlt(authorName, index)}
          title={strings.community.postImageAlt(authorName, index)}
        >
          {(open) => (
            <button
              type="button"
              onClick={open}
              className={`block w-full cursor-zoom-in bg-slate-100 ${cellClassName(images.length, index)}`}
            >
              <img
                src={src}
                alt={strings.community.postImageAlt(authorName, index)}
                className={`h-full w-full object-cover ${aspectClassName(images.length, index)}`}
              />
            </button>
          )}
        </ImageViewer>
      ))}
    </div>
  );
}

export default ImageGrid;
