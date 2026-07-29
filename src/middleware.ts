import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/registration-submitted',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/health',
  '/api/live'
];

const PUBLIC_FILE = /\.[^/]+$/;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }
  if (!isApi && PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (session) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/auth/login';

  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;

  const response = NextResponse.redirect(url);
  if (token) response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
