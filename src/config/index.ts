import {
  APP_DEFAULTS,
  AUTHOR,
  GROUP_DEFAULTS,
  PAGINATION_DEFAULTS,
  PASSWORD_DEFAULTS,
  SECURITY_DEFAULTS,
  SESSION_DEFAULTS,
  UI_DEFAULTS,
  MAIL_DEFAULTS,
  UPLOAD_DEFAULTS,
  VALIDATION_DEFAULTS
} from '@/config/defaults';

const BROWSER_ENV: Record<string, string | undefined> = {
  APP_NAME: process.env.APP_NAME,
  APP_TAGLINE: process.env.APP_TAGLINE,
  APP_LOCALE: process.env.APP_LOCALE,
  APP_CURRENCY_CODE: process.env.APP_CURRENCY_CODE,
  APP_CURRENCY_SYMBOL: process.env.APP_CURRENCY_SYMBOL,
  APP_DATE_LOCALE: process.env.APP_DATE_LOCALE,
  APP_TIME_ZONE: process.env.APP_TIME_ZONE,
  APP_AUTHOR_NAME: process.env.APP_AUTHOR_NAME,
  APP_AUTHOR_EMAIL: process.env.APP_AUTHOR_EMAIL,
  APP_AUTHOR_ROLE: process.env.APP_AUTHOR_ROLE,
  APP_AUTHOR_URL: process.env.APP_AUTHOR_URL,
  APP_LICENSE: process.env.APP_LICENSE,
  APP_COPYRIGHT_START_YEAR: process.env.APP_COPYRIGHT_START_YEAR,
  PASSWORD_MIN_LENGTH: process.env.PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH: process.env.PASSWORD_MAX_LENGTH,
  GROUP_MAX_PER_SUPERVISOR: process.env.GROUP_MAX_PER_SUPERVISOR,
  GROUP_MAX_NAME_LENGTH: process.env.GROUP_MAX_NAME_LENGTH,
  GROUP_MEAL_WEIGHT_BREAKFAST: process.env.GROUP_MEAL_WEIGHT_BREAKFAST,
  GROUP_MEAL_WEIGHT_LUNCH: process.env.GROUP_MEAL_WEIGHT_LUNCH,
  GROUP_MEAL_WEIGHT_DINNER: process.env.GROUP_MEAL_WEIGHT_DINNER,
  VALIDATION_NAME_MIN_LENGTH: process.env.VALIDATION_NAME_MIN_LENGTH,
  VALIDATION_NAME_MAX_LENGTH: process.env.VALIDATION_NAME_MAX_LENGTH,
  VALIDATION_EMAIL_MAX_LENGTH: process.env.VALIDATION_EMAIL_MAX_LENGTH,
  VALIDATION_PHONE_MIN_DIGITS: process.env.VALIDATION_PHONE_MIN_DIGITS,
  VALIDATION_PHONE_MAX_DIGITS: process.env.VALIDATION_PHONE_MAX_DIGITS,
  VALIDATION_NOTE_MAX_LENGTH: process.env.VALIDATION_NOTE_MAX_LENGTH,
  VALIDATION_COMMENT_MAX_LENGTH: process.env.VALIDATION_COMMENT_MAX_LENGTH,
  VALIDATION_MAX_MONEY_AMOUNT: process.env.VALIDATION_MAX_MONEY_AMOUNT,
  UPLOAD_MAX_IMAGE_BYTES: process.env.UPLOAD_MAX_IMAGE_BYTES,
  PAGINATION_PAGE_SIZE: process.env.PAGINATION_PAGE_SIZE,
  PAGINATION_MAX_PAGE_SIZE: process.env.PAGINATION_MAX_PAGE_SIZE,
  UI_TOAST_DURATION_MS: process.env.UI_TOAST_DURATION_MS,
  UI_TOAST_DEDUPE_WINDOW_MS: process.env.UI_TOAST_DEDUPE_WINDOW_MS,
  UI_SEARCH_DEBOUNCE_MS: process.env.UI_SEARCH_DEBOUNCE_MS,
  UI_MONTHS_BACK: process.env.UI_MONTHS_BACK,
  UI_MONTHS_FORWARD: process.env.UI_MONTHS_FORWARD
};

function readRaw(key: string): string | undefined {
  const direct = process.env[key];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const inlined = BROWSER_ENV[key];
  return typeof inlined === 'string' && inlined.trim() ? inlined.trim() : undefined;
}

function readString(key: string, fallback: string): string {
  return readRaw(key) ?? fallback;
}

function readOptionalString(key: string): string | null {
  return readRaw(key) ?? null;
}

function readNumber(key: string, fallback: number): number {
  const raw = readRaw(key);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readInt(key: string, fallback: number, min = 1): number {
  const value = Math.trunc(readNumber(key, fallback));
  return value >= min ? value : fallback;
}

function readBoolean(key: string, fallback: boolean): boolean {
  const raw = readRaw(key);
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export const nodeEnv = readString('NODE_ENV', 'development');
export const isProduction = nodeEnv === 'production';
export const isTest = nodeEnv === 'test';

export const appConfig = {
  name: readString('APP_NAME', APP_DEFAULTS.name),
  tagline: readString('APP_TAGLINE', APP_DEFAULTS.tagline),
  locale: readString('APP_LOCALE', APP_DEFAULTS.locale),
  currencyCode: readString('APP_CURRENCY_CODE', APP_DEFAULTS.currencyCode),
  currencySymbol: readString('APP_CURRENCY_SYMBOL', APP_DEFAULTS.currencySymbol),
  dateLocale: readString('APP_DATE_LOCALE', APP_DEFAULTS.dateLocale),
  timeZone: readString('APP_TIME_ZONE', APP_DEFAULTS.timeZone)
} as const;

export const authorConfig = {
  name: readString('APP_AUTHOR_NAME', AUTHOR.name),
  email: readString('APP_AUTHOR_EMAIL', AUTHOR.email),
  role: readString('APP_AUTHOR_ROLE', AUTHOR.role),
  license: readString('APP_LICENSE', AUTHOR.license),
  copyrightStartYear: readInt('APP_COPYRIGHT_START_YEAR', AUTHOR.copyrightStartYear),
  url: readString('APP_AUTHOR_URL', AUTHOR.url)
} as const;

export const sessionConfig = {
  cookieName: readString('SESSION_COOKIE_NAME', SESSION_DEFAULTS.cookieName),
  legacyCookieName: SESSION_DEFAULTS.legacyCookieName,
  impersonationCookieName: SESSION_DEFAULTS.impersonationCookieName,
  impersonationMaxAgeSeconds: readInt('IMPERSONATION_MAX_AGE_SECONDS', SESSION_DEFAULTS.impersonationMaxAgeSeconds),
  maxAgeSeconds: readInt('SESSION_MAX_AGE_SECONDS', SESSION_DEFAULTS.maxAgeSeconds),
  refreshAfterSeconds: readInt('SESSION_REFRESH_AFTER_SECONDS', SESSION_DEFAULTS.refreshAfterSeconds),
  minSecretLength: SESSION_DEFAULTS.minSecretLength,
  secret: readOptionalString('AUTH_SECRET'),
  cookieSecure: readBoolean('SESSION_COOKIE_SECURE', isProduction)
} as const;

export const passwordConfig = {
  minLength: readInt('PASSWORD_MIN_LENGTH', PASSWORD_DEFAULTS.minLength),
  maxLength: readInt('PASSWORD_MAX_LENGTH', PASSWORD_DEFAULTS.maxLength),
  scryptCost: readInt('PASSWORD_SCRYPT_COST', PASSWORD_DEFAULTS.scryptCost),
  scryptBlockSize: readInt('PASSWORD_SCRYPT_BLOCK_SIZE', PASSWORD_DEFAULTS.scryptBlockSize),
  scryptParallelism: readInt('PASSWORD_SCRYPT_PARALLELISM', PASSWORD_DEFAULTS.scryptParallelism),
  scryptKeyLength: PASSWORD_DEFAULTS.scryptKeyLength,
  scryptSaltLength: PASSWORD_DEFAULTS.scryptSaltLength
} as const;

export const securityConfig = {
  maxLoginAttempts: readInt('SECURITY_MAX_LOGIN_ATTEMPTS', SECURITY_DEFAULTS.maxLoginAttempts),
  loginLockoutMinutes: readInt('SECURITY_LOGIN_LOCKOUT_MINUTES', SECURITY_DEFAULTS.loginLockoutMinutes),
  maxLoginAttemptsPerIp: readInt('SECURITY_MAX_LOGIN_ATTEMPTS_PER_IP', SECURITY_DEFAULTS.maxLoginAttemptsPerIp),
  ipLockoutMinutes: readInt('SECURITY_IP_LOCKOUT_MINUTES', SECURITY_DEFAULTS.ipLockoutMinutes),
  maxRegistrationsPerIp: readInt('SECURITY_MAX_REGISTRATIONS_PER_IP', SECURITY_DEFAULTS.maxRegistrationsPerIp),
  registrationWindowMinutes: readInt(
    'SECURITY_REGISTRATION_WINDOW_MINUTES',
    SECURITY_DEFAULTS.registrationWindowMinutes
  ),
  maxWriteRequestsPerMinute: readInt(
    'SECURITY_MAX_WRITE_REQUESTS_PER_MINUTE',
    SECURITY_DEFAULTS.maxWriteRequestsPerMinute
  ),
  maxReadRequestsPerMinute: readInt(
    'SECURITY_MAX_READ_REQUESTS_PER_MINUTE',
    SECURITY_DEFAULTS.maxReadRequestsPerMinute
  ),
  maxRequestBodyBytes: readInt('SECURITY_MAX_REQUEST_BODY_BYTES', SECURITY_DEFAULTS.maxRequestBodyBytes),
  loginAttemptRetentionDays: readInt(
    'SECURITY_LOGIN_ATTEMPT_RETENTION_DAYS',
    SECURITY_DEFAULTS.loginAttemptRetentionDays
  ),
  trustProxyHeaders: readBoolean('SECURITY_TRUST_PROXY_HEADERS', isProduction)
} as const;

export const groupConfig = {
  maxGroupsPerSupervisor: readInt('GROUP_MAX_PER_SUPERVISOR', GROUP_DEFAULTS.maxGroupsPerSupervisor),
  maxNameLength: readInt('GROUP_MAX_NAME_LENGTH', GROUP_DEFAULTS.maxNameLength),
  mealWeightBreakfast: readNumber('GROUP_MEAL_WEIGHT_BREAKFAST', GROUP_DEFAULTS.mealWeightBreakfast),
  mealWeightLunch: readNumber('GROUP_MEAL_WEIGHT_LUNCH', GROUP_DEFAULTS.mealWeightLunch),
  mealWeightDinner: readNumber('GROUP_MEAL_WEIGHT_DINNER', GROUP_DEFAULTS.mealWeightDinner)
} as const;

export const validationConfig = {
  nameMinLength: readInt('VALIDATION_NAME_MIN_LENGTH', VALIDATION_DEFAULTS.nameMinLength),
  nameMaxLength: readInt('VALIDATION_NAME_MAX_LENGTH', VALIDATION_DEFAULTS.nameMaxLength),
  emailMaxLength: readInt('VALIDATION_EMAIL_MAX_LENGTH', VALIDATION_DEFAULTS.emailMaxLength),
  phoneMinDigits: readInt('VALIDATION_PHONE_MIN_DIGITS', VALIDATION_DEFAULTS.phoneMinDigits),
  phoneMaxDigits: readInt('VALIDATION_PHONE_MAX_DIGITS', VALIDATION_DEFAULTS.phoneMaxDigits),
  noteMaxLength: readInt('VALIDATION_NOTE_MAX_LENGTH', VALIDATION_DEFAULTS.noteMaxLength),
  commentMaxLength: readInt('VALIDATION_COMMENT_MAX_LENGTH', VALIDATION_DEFAULTS.commentMaxLength),
  maxMoneyAmount: readNumber('VALIDATION_MAX_MONEY_AMOUNT', VALIDATION_DEFAULTS.maxMoneyAmount)
} as const;

export const uploadConfig = {
  directory: readOptionalString('UPLOAD_DIR'),
  directoryName: UPLOAD_DEFAULTS.directoryName,
  maxImageBytes: readInt('UPLOAD_MAX_IMAGE_BYTES', UPLOAD_DEFAULTS.maxImageBytes),
  routePrefix: UPLOAD_DEFAULTS.routePrefix,
  cacheMaxAgeSeconds: readInt('UPLOAD_CACHE_MAX_AGE_SECONDS', UPLOAD_DEFAULTS.cacheMaxAgeSeconds)
} as const;

export const paginationConfig = {
  pageSize: readInt('PAGINATION_PAGE_SIZE', PAGINATION_DEFAULTS.pageSize),
  maxPageSize: readInt('PAGINATION_MAX_PAGE_SIZE', PAGINATION_DEFAULTS.maxPageSize),
  pageSizeOptions: PAGINATION_DEFAULTS.pageSizeOptions
} as const;

export const uiConfig = {
  toastDurationMs: readInt('UI_TOAST_DURATION_MS', UI_DEFAULTS.toastDurationMs),
  toastDedupeWindowMs: readInt('UI_TOAST_DEDUPE_WINDOW_MS', UI_DEFAULTS.toastDedupeWindowMs),
  searchDebounceMs: readInt('UI_SEARCH_DEBOUNCE_MS', UI_DEFAULTS.searchDebounceMs),
  monthsBack: readInt('UI_MONTHS_BACK', UI_DEFAULTS.monthsBack),
  monthsForward: readInt('UI_MONTHS_FORWARD', UI_DEFAULTS.monthsForward, 0)
} as const;

export const seedConfig = {
  enabled: readBoolean('SEED_ENABLED', !isProduction),
  emailDomain: readString('SEED_EMAIL_DOMAIN', 'bachelorpoint.local'),
  supervisors: readInt('SEED_SUPERVISORS', 4),
  members: readInt('SEED_MEMBERS', 120),
  groups: readInt('SEED_GROUPS', 10),
  membersPerGroup: readInt('SEED_MEMBERS_PER_GROUP', 10),
  pendingUsers: readInt('SEED_PENDING_USERS', 5),
  rejectedUsers: readInt('SEED_REJECTED_USERS', 3),
  subscribers: readInt('SEED_SUBSCRIBERS', 12)
} as const;

export const adminBootstrapConfig = {
  email: readOptionalString('ADMIN_EMAIL'),
  password: readOptionalString('ADMIN_PASSWORD'),
  name: readString('ADMIN_NAME', 'System Administrator'),
  phone: readOptionalString('ADMIN_PHONE'),
  enabled: readBoolean('ADMIN_BOOTSTRAP_ENABLED', true)
} as const;

export const mailConfig = {
  host: readOptionalString('SMTP_HOST'),
  port: readInt('SMTP_PORT', MAIL_DEFAULTS.port),
  user: readOptionalString('SMTP_USER'),
  password: readOptionalString('SMTP_PASSWORD'),
  from: readOptionalString('SMTP_FROM'),
  helo: readString('SMTP_HELO', MAIL_DEFAULTS.helo),
  timeoutMs: readInt('SMTP_TIMEOUT_MS', MAIL_DEFAULTS.timeoutMs)
} as const;

export const appUrlConfig = {
  publicUrl: readOptionalString('APP_PUBLIC_URL')
} as const;

export const emailQualityConfig = {
  requireMx: readBoolean('EMAIL_REQUIRE_MX', true),
  mxResolvers: readString('EMAIL_MX_RESOLVERS', '1.1.1.1,8.8.8.8')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  mxTimeoutMs: readInt('EMAIL_MX_TIMEOUT_MS', 3000)
} as const;

export const passwordTokenConfig = {
  minutes: readInt('PASSWORD_TOKEN_MINUTES', MAIL_DEFAULTS.passwordTokenMinutes),
  bytes: MAIL_DEFAULTS.passwordTokenBytes
} as const;
