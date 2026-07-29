// Shared input validation. Used by the API routes; the auth pages import the
// same helpers so the client shows the same rules the server enforces.

/**
 * Deliberately permissive. Over-strict email regexes reject valid addresses, and
 * the only reliable proof an address works is sending mail to it — so we check
 * shape only: something, one @, a dotted domain, no spaces.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254; // RFC 5321 limit

/** Lower-cases and trims so `Saidul@Gmail.com` and `saidul@gmail.com` are one account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const value = normalizeEmail(email);
  return value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);
}

export function validateEmail(email: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof email !== 'string' || !email.trim()) {
    return { ok: false, error: 'Email is required.' };
  }
  const value = normalizeEmail(email);
  if (!isValidEmail(value)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  return { ok: true, value };
}

export function validateName(name: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, error: 'Name is required.' };
  }
  // Collapse runs of whitespace so "Saidul    Islam" stores as "Saidul Islam".
  const value = name.trim().replace(/\s+/g, ' ');
  if (value.length < NAME_MIN_LENGTH) {
    return { ok: false, error: `Name must be at least ${NAME_MIN_LENGTH} characters.` };
  }
  if (value.length > NAME_MAX_LENGTH) {
    return { ok: false, error: `Name must be at most ${NAME_MAX_LENGTH} characters.` };
  }
  return { ok: true, value };
}

/**
 * Bangladeshi mobile numbers are the common case, but members abroad exist, so
 * we accept any plausible international number rather than pinning to +880.
 */
export function validatePhone(phone: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (phone === undefined || phone === null) return { ok: true, value: null };
  if (typeof phone !== 'string') return { ok: false, error: 'Enter a valid phone number.' };

  const value = phone.trim();
  if (!value) return { ok: true, value: null };

  const digits = value.replace(/[\s()-]/g, '');
  if (!/^\+?\d{6,15}$/.test(digits)) {
    return { ok: false, error: 'Enter a valid phone number (6-15 digits, optionally starting with +).' };
  }
  return { ok: true, value: digits };
}

/** A rough 0-4 strength score for the sign-up meter. Client-side hint only. */
export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: 'Too short' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes >= 3) score += 1;

  // A long string of one repeated character should never read as strong.
  if (/^(.)\1+$/.test(password) || /^(..)\1+$/.test(password)) score = Math.min(score, 1);
  if (password.length < 8) score = 0;

  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][clamped] };
}
