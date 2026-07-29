// Profile image storage.
//
// Images arrive as a data URL in the JSON body (no multipart parser, so no extra
// dependency) and are written to an `uploads/` directory beside the project.
// The stored value on the user row is the URL that serves it back.
//
// Why not `public/`: Next.js snapshots the contents of `public/` when it builds,
// so anything written there at runtime 404s under `next start`. Uploads are
// therefore streamed back by `/api/uploads/[file]`, which reads from disk on each
// request — and, as a bonus, requires a session, so avatars are not world-readable.
//
// Note for hosting: this writes to the local filesystem, which is right for the
// self-hosted SQL Server setup this app targets. On a platform with an ephemeral
// filesystem (Vercel, containers without a volume) set UPLOAD_DIR to a mounted
// disk or swap `saveProfileImage` for an S3/Azure Blob upload — it and
// `readProfileImage` are the only functions that touch storage.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
export const PUBLIC_UPLOAD_PREFIX = '/api/uploads/';

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), 'uploads');

// Extension and leading magic bytes per accepted type. We check the bytes rather
// than trusting the declared mime, so a renamed file cannot be stored and served.
const IMAGE_TYPES: { mime: string; ext: string; matches: (buf: Buffer) => boolean }[] = [
  {
    mime: 'image/png',
    ext: 'png',
    matches: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    matches: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP'
  },
  {
    mime: 'image/gif',
    ext: 'gif',
    matches: (b) => b.length > 6 && b.subarray(0, 6).toString('ascii').startsWith('GIF8')
  }
];

export const ACCEPTED_IMAGE_MIMES = IMAGE_TYPES.map((t) => t.mime);

type SaveResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Decode a `data:image/...;base64,...` URL, validate it, and write it to disk.
 * Returns the public path to store on the user row.
 */
export async function saveProfileImage(dataUrl: string, userId: string): Promise<SaveResult> {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) {
    return { ok: false, error: 'Image must be a base64 data URL.' };
  }

  const [, declaredMime, base64] = match;
  if (!ACCEPTED_IMAGE_MIMES.includes(declaredMime)) {
    return { ok: false, error: 'Image must be a PNG, JPEG, WebP, or GIF.' };
  }

  // base64 inflates by 4/3; reject oversized payloads before allocating a Buffer.
  if (Math.floor((base64.length * 3) / 4) > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'Image must be 2 MB or smaller.' };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, error: 'Image could not be decoded.' };
  }

  if (buffer.length === 0) return { ok: false, error: 'Image is empty.' };
  if (buffer.length > MAX_IMAGE_BYTES) return { ok: false, error: 'Image must be 2 MB or smaller.' };

  const detected = IMAGE_TYPES.find((type) => type.matches(buffer));
  if (!detected || detected.mime !== declaredMime) {
    return { ok: false, error: 'That file is not a valid image.' };
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Random suffix so a replaced avatar gets a new URL and never serves a stale
  // cached copy. The user id prefix keeps the directory easy to reason about.
  const fileName = `${userId}-${crypto.randomBytes(8).toString('hex')}.${detected.ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);

  return { ok: true, url: `${PUBLIC_UPLOAD_PREFIX}${fileName}` };
}

/** Remove a previously stored avatar. Never throws — a missing file is fine. */
export async function deleteProfileImage(url: string | null | undefined) {
  if (!url || !url.startsWith(PUBLIC_UPLOAD_PREFIX)) return;

  const fileName = safeFileName(url.slice(PUBLIC_UPLOAD_PREFIX.length));
  if (!fileName) return;

  try {
    await fs.unlink(path.join(UPLOAD_DIR, fileName));
  } catch {
    // Already gone, or never written — nothing to clean up.
  }
}

/**
 * Read a stored upload for `/api/uploads/[file]`.
 * Returns null for anything that is not a plain file name we wrote ourselves.
 */
export async function readProfileImage(name: string): Promise<{ body: Buffer; contentType: string } | null> {
  const fileName = safeFileName(name);
  if (!fileName) return null;

  const ext = path.extname(fileName).slice(1).toLowerCase();
  const type = IMAGE_TYPES.find((t) => t.ext === ext);
  if (!type) return null;

  try {
    return { body: await fs.readFile(path.join(UPLOAD_DIR, fileName)), contentType: type.mime };
  } catch {
    return null;
  }
}

/**
 * Only ever accept the exact shape we generate: `<uuid>-<hex>.<ext>`.
 * That rules out `..`, nested paths, absolute paths, and NUL bytes in one go,
 * rather than trying to sanitise a hostile string.
 */
function safeFileName(name: string): string | null {
  return /^[a-f0-9-]{36}-[a-f0-9]{16}\.(png|jpg|webp|gif)$/i.test(name) ? name : null;
}
