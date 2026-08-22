import type { NextApiResponse } from 'next';
import {
  createImpersonationToken,
  createSessionToken,
  IMPERSONATION_COOKIE_NAME,
  IMPERSONATION_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS
} from '@/lib/session';
import { IDENTITY_COOKIE, identityCookieDomain, issueIdentity, ssoEnabled } from '@/lib/identity';
import { THEME_OPTION_VALUES } from '@/lib/constants';
import { sessionConfig } from '@/config';

export { SESSION_COOKIE_NAME, IMPERSONATION_COOKIE_NAME } from '@/lib/session';
export { IDENTITY_COOKIE } from '@/lib/identity';

export const LEGACY_SESSION_COOKIE_NAME = 'bachelor_point_legacy_session';
export const THEME_COOKIE_NAME = 'bachelor_point_theme';
const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseCookies(cookieHeader?: string) {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (!name) continue;
    cookies[name] = decodeURIComponent(valueParts.join('='));
  }

  return cookies;
}

export function serializeCookie(
  name: string,
  value: string,
  options?: {
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
    secure?: boolean;
    domain?: string;
  }
) {
  const opts = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: sessionConfig.cookieSecure,
    ...options
  };

  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path}`, `SameSite=${opts.sameSite}`];

  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);

  return parts.join('; ');
}

export function appendCookie(res: NextApiResponse, cookie: string) {
  const existing = res.getHeader('Set-Cookie');
  const list = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
  res.setHeader('Set-Cookie', [...list, cookie]);
}

export type SessionCookieUser = {
  id: string;
  name: string;
  email: string;
  tokenVersion: number;
};

async function setIdentityCookie(res: NextApiResponse, user: SessionCookieUser) {
  if (!ssoEnabled()) return;

  const domain = identityCookieDomain();

  appendCookie(
    res,
    serializeCookie(IDENTITY_COOKIE, await issueIdentity(user), {
      maxAge: SESSION_MAX_AGE_SECONDS,
      ...(domain ? { domain } : {})
    })
  );
}

export async function setSessionCookie(res: NextApiResponse, user: SessionCookieUser) {
  const token = await createSessionToken(user.id, user.tokenVersion);
  appendCookie(res, serializeCookie(SESSION_COOKIE_NAME, token, { maxAge: SESSION_MAX_AGE_SECONDS }));
  appendCookie(res, serializeCookie(LEGACY_SESSION_COOKIE_NAME, '', { maxAge: 0 }));
  await setIdentityCookie(res, user);
}

export function clearSessionCookie(res: NextApiResponse) {
  const domain = identityCookieDomain();

  appendCookie(res, serializeCookie(SESSION_COOKIE_NAME, '', { maxAge: 0 }));
  appendCookie(res, serializeCookie(LEGACY_SESSION_COOKIE_NAME, '', { maxAge: 0 }));

  appendCookie(
    res,
    serializeCookie(IDENTITY_COOKIE, '', { maxAge: 0, ...(domain ? { domain } : {}) })
  );

  clearImpersonationCookie(res);
}

export async function setImpersonationCookie(
  res: NextApiResponse,
  adminId: string,
  targetId: string,
  targetTokenVersion: number
) {
  const token = await createImpersonationToken(adminId, targetId, targetTokenVersion);
  appendCookie(res, serializeCookie(IMPERSONATION_COOKIE_NAME, token, { maxAge: IMPERSONATION_MAX_AGE_SECONDS }));
}

export function clearImpersonationCookie(res: NextApiResponse) {
  appendCookie(res, serializeCookie(IMPERSONATION_COOKIE_NAME, '', { maxAge: 0 }));
}

export function setThemeCookie(res: NextApiResponse, theme: string) {
  if (!THEME_OPTION_VALUES.includes(theme)) return;
  appendCookie(
    res,
    serializeCookie(THEME_COOKIE_NAME, theme, { maxAge: THEME_COOKIE_MAX_AGE_SECONDS, httpOnly: false })
  );
}
