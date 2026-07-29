import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

// Routes reachable without a session.
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/registration-submitted',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/health'
];

// Static assets under /public (logo.svg, favicon.png, ...). Deliberately does NOT
// apply to /api/*: an API route whose path happens to contain a dot must still be
// authenticated — /api/uploads/[file] is exactly that case.
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

  // Verify the signature here, not just the cookie's presence: a forged or
  // expired token must be turned away at the edge, before it reaches a page.
  // API routes re-check against the database; this is the cheap first gate.
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (session) {
    return NextResponse.next();
  }

  // APIs get a JSON 401 — a redirect to an HTML page would break every fetch().
  if (isApi) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/auth/login';
  // Remember where they were headed so login can send them back.
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;

  const response = NextResponse.redirect(url);
  if (token) response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
