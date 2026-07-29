import { validationConfig } from '@/config';
import { strings } from '@/lib/i18n';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const value = normalizeEmail(email);
  return value.length <= validationConfig.emailMaxLength && EMAIL_PATTERN.test(value);
}

export function validateEmail(email: unknown): ValidationResult<string> {
  if (typeof email !== 'string' || !email.trim()) {
    return { ok: false, error: strings.validation.emailRequired };
  }
  const value = normalizeEmail(email);
  if (!isValidEmail(value)) {
    return { ok: false, error: strings.validation.emailInvalid };
  }
  return { ok: true, value };
}

export function validateName(name: unknown): ValidationResult<string> {
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, error: strings.validation.nameRequired };
  }
  const value = name.trim().replace(/\s+/g, ' ');
  if (value.length < validationConfig.nameMinLength) {
    return { ok: false, error: strings.validation.nameTooShort(validationConfig.nameMinLength) };
  }
  if (value.length > validationConfig.nameMaxLength) {
    return { ok: false, error: strings.validation.nameTooLong(validationConfig.nameMaxLength) };
  }
  return { ok: true, value };
}

export function validatePhone(phone: unknown): ValidationResult<string | null> {
  if (phone === undefined || phone === null) return { ok: true, value: null };
  if (typeof phone !== 'string') {
    return {
      ok: false,
      error: strings.validation.phoneInvalid(validationConfig.phoneMinDigits, validationConfig.phoneMaxDigits)
    };
  }

  const value = phone.trim();
  if (!value) return { ok: true, value: null };

  const digits = value.replace(/[\s()-]/g, '');
  const pattern = new RegExp(`^\\+?\\d{${validationConfig.phoneMinDigits},${validationConfig.phoneMaxDigits}}$`);
  if (!pattern.test(digits)) {
    return {
      ok: false,
      error: strings.validation.phoneInvalid(validationConfig.phoneMinDigits, validationConfig.phoneMaxDigits)
    };
  }
  return { ok: true, value: digits };
}

export function validateText(value: unknown, maxLength: number, required = false): ValidationResult<string> {
  if (typeof value !== 'string') {
    return required ? { ok: false, error: strings.validation.required(strings.common.note) } : { ok: true, value: '' };
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    return { ok: false, error: strings.validation.required(strings.common.note) };
  }
  if (trimmed.length > maxLength) {
    return { ok: false, error: strings.validation.textTooLong(maxLength) };
  }
  return { ok: true, value: trimmed };
}

export function validateAmount(amount: unknown): ValidationResult<number> {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: strings.validation.amountPositive };
  }
  if (value > validationConfig.maxMoneyAmount) {
    return { ok: false, error: strings.validation.amountTooLarge };
  }
  return { ok: true, value };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDayKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value);
}

export function validateDayKey(value: unknown): ValidationResult<string> {
  if (!isValidDayKey(value)) {
    return { ok: false, error: strings.validation.dateRequired };
  }
  return { ok: true, value };
}

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

const STRENGTH_LABELS = [
  strings.auth.passwordStrength.tooShort,
  strings.auth.passwordStrength.weak,
  strings.auth.passwordStrength.fair,
  strings.auth.passwordStrength.good,
  strings.auth.passwordStrength.strong
];

export const STRONG_PASSWORD_MIN_SCORE: PasswordScore = 3;

export function passwordStrength(password: string): { score: PasswordScore; label: string } {
  if (!password) return { score: 0, label: STRENGTH_LABELS[0] };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (classes >= 3) score += 1;

  if (/^(.)\1+$/.test(password) || /^(..)\1+$/.test(password)) score = Math.min(score, 1);
  if (password.length < 8) score = 0;

  const clamped = Math.min(4, score) as PasswordScore;
  return { score: clamped, label: STRENGTH_LABELS[clamped] };
}
