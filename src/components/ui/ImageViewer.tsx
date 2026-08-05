import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { strings } from '@/lib/i18n';

export type ImageViewerProps = {
  src: string;
  alt: string;
  title: string;
  children: (open: () => void) => ReactNode;
};

export function ImageViewer({ src, alt, title, children }: ImageViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {children(() => setOpen(true))}
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="lg">
        <img
          src={src}
          alt={alt}
          className="mx-auto max-h-[70vh] w-auto max-w-full rounded-2xl bg-slate-100 object-contain"
        />
        <p className="mt-3 text-center text-xs text-slate-400">{strings.common.viewImageHint}</p>
      </Modal>
    </>
  );
}

export default ImageViewer;
