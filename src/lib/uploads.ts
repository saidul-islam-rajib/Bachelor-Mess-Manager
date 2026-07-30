import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { uploadConfig } from '@/config';
import { strings } from '@/lib/i18n';

export const MAX_IMAGE_BYTES = uploadConfig.maxImageBytes;
export const PUBLIC_UPLOAD_PREFIX = uploadConfig.routePrefix;

const UPLOAD_DIR = uploadConfig.directory
  ? path.resolve(uploadConfig.directory)
  : path.join(process.cwd(), uploadConfig.directoryName);

const IMAGE_TYPES: { mime: string; ext: string; matches: (buffer: Buffer) => boolean }[] = [
  {
    mime: 'image/png',
    ext: 'png',
    matches: (buffer) =>
      buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    matches: (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    matches: (buffer) =>
      buffer.length > 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  },
  {
    mime: 'image/gif',
    ext: 'gif',
    matches: (buffer) => buffer.length > 6 && buffer.subarray(0, 6).toString('ascii').startsWith('GIF8')
  }
];

export const ACCEPTED_IMAGE_MIMES = IMAGE_TYPES.map((type) => type.mime);

const FILE_NAME_PATTERN = /^[a-f0-9-]{36}-[a-f0-9]{16}\.(png|jpg|webp|gif)$/i;

type SaveResult = { ok: true; url: string } | { ok: false; error: string };

export async function saveProfileImage(dataUrl: string, userId: string): Promise<SaveResult> {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) {
    return { ok: false, error: strings.profile.imageNotDataUrl };
  }

  const [, declaredMime, base64] = match;
  if (!ACCEPTED_IMAGE_MIMES.includes(declaredMime)) {
    return { ok: false, error: strings.profile.imageWrongType };
  }

  const maxMegabytes = Math.round(uploadConfig.maxImageBytes / (1024 * 1024));

  if (Math.floor((base64.length * 3) / 4) > uploadConfig.maxImageBytes) {
    return { ok: false, error: strings.profile.imageTooLarge(maxMegabytes) };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, error: strings.profile.imageUndecodable };
  }

  if (buffer.length === 0) return { ok: false, error: strings.profile.imageEmpty };
  if (buffer.length > uploadConfig.maxImageBytes) {
    return { ok: false, error: strings.profile.imageTooLarge(maxMegabytes) };
  }

  const detected = IMAGE_TYPES.find((type) => type.matches(buffer));
  if (!detected || detected.mime !== declaredMime) {
    return { ok: false, error: strings.profile.imageInvalid };
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const fileName = `${userId}-${crypto.randomBytes(8).toString('hex')}.${detected.ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);

  return { ok: true, url: `${uploadConfig.routePrefix}${fileName}` };
}

export async function deleteProfileImage(url: string | null | undefined) {
  if (!url || !url.startsWith(uploadConfig.routePrefix)) return;

  const fileName = safeFileName(url.slice(uploadConfig.routePrefix.length));
  if (!fileName) return;

  try {
    await fs.unlink(path.join(UPLOAD_DIR, fileName));
  } catch {
    return;
  }
}

export async function readProfileImage(name: string): Promise<{ body: Buffer; contentType: string } | null> {
  const fileName = safeFileName(name);
  if (!fileName) return null;

  const ext = path.extname(fileName).slice(1).toLowerCase();
  const type = IMAGE_TYPES.find((candidate) => candidate.ext === ext);
  if (!type) return null;

  try {
    return { body: await fs.readFile(path.join(UPLOAD_DIR, fileName)), contentType: type.mime };
  } catch {
    return null;
  }
}

function safeFileName(name: string): string | null {
  return FILE_NAME_PATTERN.test(name) ? name : null;
}
