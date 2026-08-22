import { useState } from 'react';
import { ImageViewer } from '@/components/ui';
import { strings } from '@/lib/i18n';

export function ToLetGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        {strings.toLet.noPhotos}
      </div>
    );
  }

  const index = Math.min(active, images.length - 1);
  const src = images[index];
  const alt = strings.toLet.photoAlt(title, index);

  return (
    <div>
      <ImageViewer src={src} alt={alt} title={title}>
        {(open) => (
          <button
            type="button"
            onClick={open}
            className="block w-full cursor-zoom-in overflow-hidden rounded-3xl bg-slate-100"
          >
            <img src={src} alt={alt} className="aspect-[16/10] w-full object-cover" />
          </button>
        )}
      </ImageViewer>

      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, imageIndex) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(imageIndex)}
              aria-label={strings.toLet.photoAlt(title, imageIndex)}
              aria-pressed={imageIndex === index}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                imageIndex === index ? 'border-brand-500' : 'border-transparent'
              }`}
            >
              <img src={image} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ToLetGallery;
