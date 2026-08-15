import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';

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
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="lg" bodyClassName="">
        <img src={src} alt={alt} className="max-h-[80vh] w-full bg-slate-100 object-contain" />
      </Modal>
    </>
  );
}

export default ImageViewer;
