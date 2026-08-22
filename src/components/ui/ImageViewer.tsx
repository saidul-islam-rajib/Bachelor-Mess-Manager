import { useState, type ReactNode } from 'react';
import { PhotoLightbox } from '@/components/ui/PhotoLightbox';

export type ImageViewerProps = {
  src: string;
  alt: string;
  children: (open: () => void) => ReactNode;
};

export function ImageViewer({ src, alt, children }: ImageViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {children(() => setOpen(true))}
      {open && (
        <PhotoLightbox images={[src]} index={0} onIndexChange={() => undefined} onClose={() => setOpen(false)} altFor={() => alt} />
      )}
    </>
  );
}

export default ImageViewer;
