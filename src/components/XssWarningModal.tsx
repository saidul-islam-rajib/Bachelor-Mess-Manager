import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

export const XSS_IMAGE_SRC = '/xss-blocked.png';

export type XssWarningModalProps = {
  open: boolean;
  field?: string | null;
  onClose: () => void;
};

export function XssWarningModal({ open, field, onClose }: XssWarningModalProps) {
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="xss-warning-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 text-center shadow-2xl ring-1 ring-slate-700"
        onClick={(event) => event.stopPropagation()}
      >
        {!imageBroken ? (
          <Image
            src={XSS_IMAGE_SRC}
            alt="Blocked"
            width={512}
            height={512}
            className="h-auto w-full"
            onError={() => setImageBroken(true)}
            priority
          />
        ) : (
          <div className="flex h-48 items-center justify-center bg-slate-800 text-6xl">🚫</div>
        )}

        <div className="p-6">
          <h2 id="xss-warning-title" className="text-lg font-semibold text-white">
            Nice try.
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            That input looks like a script injection attempt, so it was blocked before it reached the
            server.
            {field ? <span className="block mt-1 text-slate-400">Field: {field}</span> : null}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Remove any HTML tags or scripts and try again.
          </p>

          <Button className="mt-6 w-full" onClick={onClose}>
            Understood
          </Button>
        </div>
      </div>
    </div>
  );
}

export default XssWarningModal;
