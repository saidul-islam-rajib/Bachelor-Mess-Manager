export const IMAGE_FORMATS = [
  { mime: 'image/png', ext: 'png' },
  { mime: 'image/jpeg', ext: 'jpg' },
  { mime: 'image/webp', ext: 'webp' },
  { mime: 'image/gif', ext: 'gif' }
] as const;

export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const ACCEPTED_IMAGE_MIMES: string[] = IMAGE_FORMATS.map((format) => format.mime);

export const ACCEPTED_IMAGE_EXTENSIONS: string[] = IMAGE_FORMATS.map((format) => format.ext);
