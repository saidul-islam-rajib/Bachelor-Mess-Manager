// The parts of the password policy that are pure logic, with no Node crypto.
//
// Split out so the sign-up and profile pages can import the exact same rules the
// server enforces without dragging `node:crypto` into the browser bundle.
// Server code should import from `@/lib/password`, which re-exports all of this.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

// Small blocklist of the passwords that show up first in every credential-stuffing
// list. Not a substitute for a full breach corpus, but it stops the worst choices.
const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password123',
  'qwertyuiop',
  'qwerty123',
  'iloveyou',
  'admin123',
  'welcome1',
  'welcome123',
  'letmein123',
  'abc12345',
  'football',
  'baseball',
  'sunshine',
  'princess',
  'bachelor',
  'bangladesh',
  'dhaka1234',
  'messmess'
]);

/**
 * Password policy. Deliberately length-first (per NIST SP 800-63B) rather than
 * demanding a symbol/digit zoo: long passphrases beat short cryptic ones, and
 * composition rules mostly push people towards "Password1!".
 */
export function validatePassword(password: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, error: 'Password is required.' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  if (/^\s|\s$/.test(password)) {
    return { ok: false, error: 'Password cannot start or end with a space.' };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: 'That password is too common. Please choose a different one.' };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, error: 'Password cannot be a single repeated character.' };
  }
  return { ok: true };
}
