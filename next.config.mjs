const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self'",
      "manifest-src 'self'",
      "worker-src 'self'",
      "object-src 'none'"
    ].join('; ')
  }
];

const BROWSER_ENV_KEYS = [
  'APP_NAME',
  'APP_TAGLINE',
  'APP_LOCALE',
  'APP_CURRENCY_CODE',
  'APP_CURRENCY_SYMBOL',
  'APP_DATE_LOCALE',
  'APP_TIME_ZONE',
  'APP_AUTHOR_NAME',
  'APP_AUTHOR_EMAIL',
  'APP_AUTHOR_ROLE',
  'APP_AUTHOR_URL',
  'APP_AUTHOR_PROFILE_URL',
  'APP_LICENSE',
  'APP_COPYRIGHT_START_YEAR',
  'PASSWORD_MIN_LENGTH',
  'PASSWORD_MAX_LENGTH',
  'GROUP_MAX_PER_SUPERVISOR',
  'GROUP_MAX_NAME_LENGTH',
  'GROUP_MEAL_WEIGHT_BREAKFAST',
  'GROUP_MEAL_WEIGHT_LUNCH',
  'GROUP_MEAL_WEIGHT_DINNER',
  'VALIDATION_NAME_MIN_LENGTH',
  'VALIDATION_NAME_MAX_LENGTH',
  'VALIDATION_EMAIL_MAX_LENGTH',
  'VALIDATION_PHONE_MIN_DIGITS',
  'VALIDATION_PHONE_MAX_DIGITS',
  'VALIDATION_NOTE_MAX_LENGTH',
  'VALIDATION_COMMENT_MAX_LENGTH',
  'VALIDATION_MAX_MONEY_AMOUNT',
  'UPLOAD_MAX_IMAGE_BYTES',
  'PAGINATION_PAGE_SIZE',
  'PAGINATION_MAX_PAGE_SIZE',
  'UI_TOAST_DURATION_MS',
  'UI_TOAST_DEDUPE_WINDOW_MS',
  'UI_SEARCH_DEBOUNCE_MS',
  'UI_MONTHS_BACK',
  'UI_MONTHS_FORWARD',
  'COMMUNITY_PAGE_SIZE',
  'COMMUNITY_MESSAGE_MAX_LENGTH',
  'COMMUNITY_POLL_INTERVAL_MS',
  'MEAL_PROMPT_DEFAULT_BREAKFAST',
  'MEAL_PROMPT_DEFAULT_LUNCH',
  'MEAL_PROMPT_DEFAULT_DINNER',
  'MEAL_PROMPT_MAX_COUNT'
];

const browserEnv = Object.fromEntries(
  BROWSER_ENV_KEYS.filter((key) => typeof process.env[key] === 'string').map((key) => [key, process.env[key]])
);

const nextConfig = {
  reactStrictMode: true,
  env: browserEnv,
  poweredByHeader: false,
  compress: true,
  output: 'standalone',
  compiler: {
    styledComponents: false,
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false
  },
  async redirects() {
    return [
      { source: '/groups', destination: '/members', permanent: true },
      { source: '/groups/:groupId', destination: '/members?group=:groupId', permanent: true }
    ];
  },
  async headers() {
    const headers = [...securityHeaders];

    if (process.env.NODE_ENV === 'production') {
      headers.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' });
    }

    return [
      { source: '/:path*', headers },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' }
        ]
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }]
      },
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, immutable' }]
      }
    ];
  }
};

export default nextConfig;
