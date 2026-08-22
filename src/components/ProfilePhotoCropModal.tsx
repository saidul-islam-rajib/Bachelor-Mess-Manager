import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, Modal } from '@/components/ui';
import { strings } from '@/lib/i18n';

const VIEWPORT_SIZE = 280;
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

type Size = { width: number; height: number };
type Offset = { x: number; y: number };

function clampOffset(next: Offset, scale: number, dims: Size): Offset {
  const dispW = dims.width * scale;
  const dispH = dims.height * scale;
  const minX = Math.min(0, VIEWPORT_SIZE - dispW);
  const minY = Math.min(0, VIEWPORT_SIZE - dispH);
  return {
    x: Math.min(0, Math.max(minX, next.x)),
    y: Math.min(0, Math.max(minY, next.y))
  };
}

type Props = {
  file: File | null;
  onCancel: () => void;
  onCropped: (dataUrl: string) => Promise<void>;
};

export function ProfilePhotoCropModal({ file, onCancel, onCropped }: Props) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startOffset: Offset } | null>(null);

  useEffect(() => {
    if (!file) {
      setImgSrc(null);
      setNatural(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    setZoom(MIN_ZOOM);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = natural ? Math.max(VIEWPORT_SIZE / natural.width, VIEWPORT_SIZE / natural.height) : 1;
  const scale = baseScale * zoom;

  function handleImageLoad() {
    const img = imgRef.current;
    if (!img) return;

    const dims = { width: img.naturalWidth, height: img.naturalHeight };
    const initialScale = Math.max(VIEWPORT_SIZE / dims.width, VIEWPORT_SIZE / dims.height);
    setNatural(dims);
    setOffset(
      clampOffset(
        { x: (VIEWPORT_SIZE - dims.width * initialScale) / 2, y: (VIEWPORT_SIZE - dims.height * initialScale) / 2 },
        initialScale,
        dims
      )
    );
  }

  function handleZoomChange(nextZoom: number) {
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    if (!natural) {
      setZoom(clampedZoom);
      return;
    }

    const nextScale = baseScale * clampedZoom;
    const anchorX = (VIEWPORT_SIZE / 2 - offset.x) / scale;
    const anchorY = (VIEWPORT_SIZE / 2 - offset.y) / scale;

    setZoom(clampedZoom);
    setOffset(
      clampOffset(
        { x: VIEWPORT_SIZE / 2 - anchorX * nextScale, y: VIEWPORT_SIZE / 2 - anchorY * nextScale },
        nextScale,
        natural
      )
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!natural) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startOffset: offset };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !natural) return;

    const next = { x: drag.startOffset.x + (event.clientX - drag.startX), y: drag.startOffset.y + (event.clientY - drag.startY) };
    setOffset(clampOffset(next, scale, natural));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  async function handleSave() {
    if (!imgRef.current || !natural) return;

    setSaving(true);

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const srcSize = VIEWPORT_SIZE / scale;
      ctx.drawImage(imgRef.current, -offset.x / scale, -offset.y / scale, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      await onCropped(canvas.toDataURL('image/jpeg', 0.92)).catch(() => undefined);
    }

    setSaving(false);
  }

  return (
    <Modal
      open={Boolean(file)}
      onClose={onCancel}
      title={strings.profile.cropTitle}
      size="sm"
      closeOnBackdrop={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            {strings.common.cancel}
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!natural}>
            {strings.common.save}
          </Button>
        </>
      }
    >
      {imgSrc && (
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative touch-none select-none overflow-hidden rounded-full bg-slate-900 cursor-grab active:cursor-grabbing"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              draggable={false}
              onLoad={handleImageLoad}
              className="pointer-events-none absolute left-0 top-0 max-w-none"
              style={
                natural
                  ? {
                      width: natural.width * scale,
                      height: natural.height * scale,
                      transform: `translate(${offset.x}px, ${offset.y}px)`
                    }
                  : { opacity: 0 }
              }
            />
          </div>

          <div className="flex w-full max-w-xs items-center gap-3">
            <button
              type="button"
              onClick={() => handleZoomChange(zoom - ZOOM_STEP)}
              aria-label={strings.profile.cropZoomOut}
              disabled={!natural}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              &minus;
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(event) => handleZoomChange(Number(event.target.value))}
              disabled={!natural}
              className="flex-1 accent-brand-600 disabled:opacity-50"
              aria-label={strings.profile.cropZoomLabel}
            />
            <button
              type="button"
              onClick={() => handleZoomChange(zoom + ZOOM_STEP)}
              aria-label={strings.profile.cropZoomIn}
              disabled={!natural}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ProfilePhotoCropModal;
