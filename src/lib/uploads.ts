import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { uploadConfig } from '@/config';
import { strings } from '@/lib/i18n';
import { formatBytes } from '@/lib/format';
import { getUploadPolicy } from '@/lib/settings-service';
import { ACCEPTED_IMAGE_EXTENSIONS, ACCEPTED_IMAGE_MIMES, IMAGE_FORMATS } from '@/lib/uploads.client';

export const PUBLIC_UPLOAD_PREFIX = uploadConfig.routePrefix;

const UPLOAD_DIR = uploadConfig.directory
  ? path.resolve(uploadConfig.directory)
  : path.join(process.cwd(), uploadConfig.directoryName);

const SIGNATURES: Record<string, (buffer: Buffer) => boolean> = {
  'image/png': (buffer) =>
    buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/webp': (buffer) =>
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  'image/gif': (buffer) => buffer.length > 6 && buffer.subarray(0, 6).toString('ascii').startsWith('GIF8')
};

const IMAGE_TYPES = IMAGE_FORMATS.map((format) => ({
  mime: format.mime as string,
  ext: format.ext as string,
  matches: SIGNATURES[format.mime]
}));

export { ACCEPTED_IMAGE_MIMES };

const FILE_NAME_PATTERN = new RegExp(
  `^[a-f0-9-]{36}-[a-f0-9]{16}\\.(${ACCEPTED_IMAGE_EXTENSIONS.join('|')})$`,
  'i'
);

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

  const { maxImageBytes } = await getUploadPolicy();
  const limitLabel = formatBytes(maxImageBytes);

  if (Math.floor((base64.length * 3) / 4) > maxImageBytes) {
    return { ok: false, error: strings.profile.imageTooLarge(limitLabel) };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, error: strings.profile.imageUndecodable };
  }

  if (buffer.length === 0) return { ok: false, error: strings.profile.imageEmpty };
  if (buffer.length > maxImageBytes) {
    return { ok: false, error: strings.profile.imageTooLarge(limitLabel) };
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

export async function profileImageExists(name: string): Promise<boolean> {
  const fileName = safeFileName(name);
  if (!fileName) return false;

  try {
    await fs.access(path.join(UPLOAD_DIR, fileName));
    return true;
  } catch {
    return false;
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
