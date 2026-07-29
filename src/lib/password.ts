import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { passwordConfig } from '@/config';
import { strings } from '@/lib/i18n';
import { passwordStrength, STRONG_PASSWORD_MIN_SCORE } from '@/lib/validation';
import { validatePassword as validatePasswordPolicy } from '@/lib/password.client';

export { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, validatePassword } from '@/lib/password.client';

const scrypt = promisify(crypto.scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

const PREFIX = 'scrypt';
const LEGACY_SHA256 = /^[a-f0-9]{64}$/i;

function maxMemFor(cost: number, blockSize: number): number {
  return 256 * cost * blockSize;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(passwordConfig.scryptSaltLength);
  const derived = await scrypt(password.normalize('NFKC'), salt, passwordConfig.scryptKeyLength, {
    N: passwordConfig.scryptCost,
    r: passwordConfig.scryptBlockSize,
    p: passwordConfig.scryptParallelism,
    maxmem: maxMemFor(passwordConfig.scryptCost, passwordConfig.scryptBlockSize)
  });

  return [
    PREFIX,
    passwordConfig.scryptCost,
    passwordConfig.scryptBlockSize,
    passwordConfig.scryptParallelism,
    salt.toString('base64'),
    derived.toString('base64')
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  if (LEGACY_SHA256.test(stored)) {
    const digest = crypto.createHash('sha256').update(password).digest('hex');
    return safeEqual(Buffer.from(digest, 'hex'), Buffer.from(stored, 'hex'));
  }

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const [, costRaw, blockSizeRaw, parallelismRaw, saltB64, hashB64] = parts;
  const cost = Number(costRaw);
  const blockSize = Number(blockSizeRaw);
  const parallelism = Number(parallelismRaw);

  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallelism)) return false;
  if (cost <= 1 || (cost & (cost - 1)) !== 0 || blockSize < 1 || parallelism < 1) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelism,
      maxmem: maxMemFor(cost, blockSize)
    });
    return safeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function needsRehash(stored: string): boolean {
  if (!stored) return true;
  if (LEGACY_SHA256.test(stored)) return true;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return true;

  return (
    Number(parts[1]) < passwordConfig.scryptCost ||
    Number(parts[2]) < passwordConfig.scryptBlockSize ||
    Number(parts[3]) < passwordConfig.scryptParallelism
  );
}

export function validatePasswordWithPolicy(
  password: unknown,
  requireStrong: boolean
): { ok: true } | { ok: false; error: string } {
  const base = validatePasswordPolicy(password);
  if (!base.ok) return base;

  if (requireStrong && passwordStrength(password as string).score < STRONG_PASSWORD_MIN_SCORE) {
    return { ok: false, error: strings.validation.passwordTooShort(passwordConfig.minLength + 4) };
  }

  return { ok: true };
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
