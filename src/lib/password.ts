// Password hashing (server only — imports node:crypto).
//
// Uses scrypt (RFC 7914) from Node's built-in crypto: memory-hard, salted per
// user, and tuned so a single verification costs ~100ms. That makes offline
// brute-forcing of a stolen database expensive, which a bare hash never does.
//
// Stored format:  scrypt$<N>$<r>$<p>$<salt-b64>$<hash-b64>
//
// Older rows in this database hold a bare unsalted SHA-256 hex digest. Those
// still verify (so nobody is locked out), but `needsRehash` flags them and the
// login route silently re-hashes them with scrypt on the next successful login.

import crypto from 'node:crypto';
import { promisify } from 'node:util';

// The policy itself lives in a browser-safe module so the forms can share it.
export { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, validatePassword } from '@/lib/password.client';

const scrypt = promisify(crypto.scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

const PREFIX = 'scrypt';
const N = 16384; // CPU/memory cost — 2^14
const R = 8; // block size
const P = 1; // parallelisation
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// scrypt needs maxmem >= 128 * N * r, with headroom for the implementation.
const MAX_MEM = 256 * N * R;

const LEGACY_SHA256 = /^[a-f0-9]{64}$/i;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEM });
  return [PREFIX, N, R, P, salt.toString('base64'), derived.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  if (LEGACY_SHA256.test(stored)) {
    const digest = crypto.createHash('sha256').update(password).digest('hex');
    return safeEqual(Buffer.from(digest, 'hex'), Buffer.from(stored, 'hex'));
  }

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n <= 1 || (n & (n - 1)) !== 0 || r < 1 || p < 1) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 256 * n * r
    });
    return safeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** True when the stored hash uses an outdated scheme or weaker parameters. */
export function needsRehash(stored: string): boolean {
  if (!stored) return true;
  if (LEGACY_SHA256.test(stored)) return true;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return true;
  return Number(parts[1]) < N || Number(parts[2]) < R || Number(parts[3]) < P;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
