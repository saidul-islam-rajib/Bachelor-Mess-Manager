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
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="fit" bodyClassName="">
        <img src={src} alt={alt} className="block max-h-[75vh] w-auto max-w-full object-contain" />
      </Modal>
    </>
  );
}

export default ImageViewer;
