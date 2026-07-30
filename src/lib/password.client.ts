import { passwordConfig } from '@/config';
import { strings } from '@/lib/i18n';

export const PASSWORD_MIN_LENGTH = passwordConfig.minLength;
export const PASSWORD_MAX_LENGTH = passwordConfig.maxLength;

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

export type PasswordValidationResult = { ok: true } | { ok: false; error: string };

export function validatePassword(password: unknown): PasswordValidationResult {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, error: strings.validation.passwordRequired };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: strings.validation.passwordTooShort(PASSWORD_MIN_LENGTH) };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: strings.validation.passwordTooLong(PASSWORD_MAX_LENGTH) };
  }
  if (/^\s|\s$/.test(password)) {
    return { ok: false, error: strings.validation.passwordSpaces };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: strings.validation.passwordCommon };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, error: strings.validation.passwordRepeated };
  }
  return { ok: true };
}
