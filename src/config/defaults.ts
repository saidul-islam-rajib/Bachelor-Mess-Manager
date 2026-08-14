export const APP_DEFAULTS = {
  name: 'Bachelor Point',
  tagline: 'Manage your mess without the arguments.',
  locale: 'en',
  currencyCode: 'BDT',
  currencySymbol: '৳',
  dateLocale: 'en-GB',
  timeZone: 'Asia/Dhaka'
} as const;

export const DATE_DEFAULTS = {
  dayKeyTimeZone: 'UTC',
  dayKeyLocale: 'en-CA',
  weekdayIndexLocale: 'en-US'
} as const;

export const AUTHOR = {
  name: 'Saidul Islam Rajib',
  email: 'saidul.is.rajib@gmail.com',
  role: 'Author & Lead Developer',
  license: 'MIT',
  copyrightStartYear: 2026,
  url: 'https://team-sober.com/',
  profileUrl: 'https://www.facebook.com/saidul.is.rajib/'
} as const;

export const SESSION_DEFAULTS = {
  cookieName: 'bachelor_point_session',
  legacyCookieName: 'bachelor_point_legacy_session',
  impersonationCookieName: 'bachelor_point_impersonation',
  impersonationMaxAgeSeconds: 60 * 60,
  maxAgeSeconds: 60 * 60 * 24 * 30,
  refreshAfterSeconds: 60 * 60 * 24,
  minSecretLength: 32
} as const;

export const PASSWORD_DEFAULTS = {
  minLength: 8,
  maxLength: 200,
  scryptCost: 16384,
  scryptBlockSize: 8,
  scryptParallelism: 1,
  scryptKeyLength: 64,
  scryptSaltLength: 16
} as const;

export const SECURITY_DEFAULTS = {
  maxLoginAttempts: 5,
  loginLockoutMinutes: 15,
  maxLoginAttemptsPerIp: 40,
  ipLockoutMinutes: 15,
  maxRegistrationsPerIp: 5,
  registrationWindowMinutes: 60,
  maxWriteRequestsPerMinute: 120,
  maxReadRequestsPerMinute: 600,
  maxRequestBodyBytes: 1024 * 1024,
  loginAttemptRetentionDays: 30
} as const;

export const GROUP_DEFAULTS = {
  maxGroupsPerSupervisor: 10,
  maxNameLength: 80,
  mealWeightBreakfast: 0.5,
  mealWeightLunch: 1,
  mealWeightDinner: 1
} as const;

export const VALIDATION_DEFAULTS = {
  nameMinLength: 2,
  nameMaxLength: 80,
  emailMaxLength: 254,
  phoneMinDigits: 6,
  phoneMaxDigits: 15,
  noteMaxLength: 500,
  commentMaxLength: 2000,
  maxMoneyAmount: 100_000_000
} as const;

export const UPLOAD_DEFAULTS = {
  directoryName: 'uploads',
  maxImageBytes: 2 * 1024 * 1024,
  minConfigurableImageBytes: 64 * 1024,
  maxConfigurableImageBytes: 10 * 1024 * 1024,
  base64OverheadRatio: 4 / 3,
  requestBodySlackBytes: 64 * 1024,
  routePrefix: '/api/uploads/',
  cacheMaxAgeSeconds: 31_536_000
} as const;

export const PAGINATION_DEFAULTS = {
  pageSize: 20,
  maxPageSize: 100,
  pageSizeOptions: [10, 20, 50, 100]
} as const;

export const UI_DEFAULTS = {
  toastDurationMs: 4000,
  toastDedupeWindowMs: 1000,
  searchDebounceMs: 300,
  monthsBack: 11,
  monthsForward: 1,
  mealDaysBefore: 2,
  mealDaysAfter: 2
} as const;

export const CACHE_DEFAULTS = {
  siteSettingsMs: 300_000,
  groupListMs: 60_000,
  sessionUserMs: 5_000,
  billsListMs: 15_000,
  dashboardGroupMs: 20_000
} as const;

export const COMMUNITY_DEFAULTS = {
  pageSize: 30,
  maxMessageLength: 1000,
  pollIntervalMs: 45_000,
  directorySize: 200,
  mentionRecipientCap: 25,
  everyoneRecipientCap: 500
} as const;

export const MEAL_PROMPT_DEFAULTS = {
  tokenBytes: 32,
  validHours: 36,
  leadDays: 0,
  breakfast: 0,
  lunch: 1,
  dinner: 1,
  batchSize: 200,
  maxCountPerMeal: 9
} as const;

export const MAIL_DEFAULTS = {
  port: 587,
  helo: 'bachelor-point',
  timeoutMs: 15000,
  passwordTokenMinutes: 5,
  passwordTokenBytes: 32
} as const;
