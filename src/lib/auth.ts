import type { NextApiRequest } from 'next';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const SESSION_COOKIE_NAME = 'mess_session_user_id';

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

export function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function getUserFromRequest(req: NextApiRequest) {
  const cookies = parseCookies(req.headers.cookie);
  const userId = cookies[SESSION_COOKIE_NAME];
  if (!userId) return null;

  return prisma.user.findUnique({ where: { id: userId } });
}
