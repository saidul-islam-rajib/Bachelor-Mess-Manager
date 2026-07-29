import type { NextApiResponse } from 'next';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/session';

export { SESSION_COOKIE_NAME } from '@/lib/session';

/**
 * The pre-hardening cookie held a bare user id and was trivially forgeable.
 * We clear it alongside every session write so old browsers drop it.
 */
export const LEGACY_SESSION_COOKIE_NAME = 'mess_session_user_id';

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
  }
) {
  const opts = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    ...options
  };

  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path}`, `SameSite=${opts.sameSite}`];

  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);

  return parts.join('; ');
}

/** Append a Set-Cookie header without dropping ones already queued on the response. */
export function appendCookie(res: NextApiResponse, cookie: string) {
  const existing = res.getHeader('Set-Cookie');
  const list = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
  res.setHeader('Set-Cookie', [...list, cookie]);
}

/** Issue a fresh signed session cookie for this user. */
export async function setSessionCookie(res: NextApiResponse, userId: string, tokenVersion: number) {
  const token = await createSessionToken(userId, tokenVersion);
  appendCookie(res, serializeCookie(SESSION_COOKIE_NAME, token, { maxAge: SESSION_MAX_AGE_SECONDS }));
  appendCookie(res, serializeCookie(LEGACY_SESSION_COOKIE_NAME, '', { maxAge: 0 }));
}

export function clearSessionCookie(res: NextApiResponse) {
  appendCookie(res, serializeCookie(SESSION_COOKIE_NAME, '', { maxAge: 0 }));
  appendCookie(res, serializeCookie(LEGACY_SESSION_COOKIE_NAME, '', { maxAge: 0 }));
}
