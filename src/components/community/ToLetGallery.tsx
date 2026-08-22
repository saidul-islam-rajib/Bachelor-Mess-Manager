import { useState } from 'react';
import { PhotoLightbox } from '@/components/ui';
import { strings } from '@/lib/i18n';

export function ToLetGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="block w-full cursor-zoom-in overflow-hidden rounded-3xl bg-slate-100"
      >
        <img src={src} alt={alt} className="aspect-[16/10] w-full object-cover" />
      </button>

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

      {lightboxOpen && (
        <PhotoLightbox
          images={images}
          index={index}
          onIndexChange={setActive}
          onClose={() => setLightboxOpen(false)}
          altFor={(i) => strings.toLet.photoAlt(title, i)}
        />
      )}
    </div>
  );
}

export default ToLetGallery;
