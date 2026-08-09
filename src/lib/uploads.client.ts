export const IMAGE_FORMATS = [
  { mime: 'image/png', ext: 'png' },
  { mime: 'image/jpeg', ext: 'jpg' },
  { mime: 'image/webp', ext: 'webp' },
  { mime: 'image/gif', ext: 'gif' }
] as const;

export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const ACCEPTED_IMAGE_MIMES: string[] = IMAGE_FORMATS.map((format) => format.mime);

export const ACCEPTED_IMAGE_EXTENSIONS: string[] = IMAGE_FORMATS.map((format) => format.ext);

export function evictCachedUpload(url: string | null | undefined): void {
  if (!url) return;
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;

  navigator.serviceWorker.controller?.postMessage({ type: 'EVICT_UPLOAD', url });
}
