import en, { type Messages } from '@/lib/i18n/locales/en';

export const SUPPORTED_LOCALES = ['en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const catalogues: Record<SupportedLocale, Messages> = { en };

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getMessages(locale: string = 'en'): Messages {
  return isSupportedLocale(locale) ? catalogues[locale] : catalogues.en;
}

export const strings: Messages = catalogues.en;

export type { Messages };
