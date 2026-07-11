import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;
const AUTH_PATHS = ['/auth/login', '/auth/register', '/api/auth/login', '/api/auth/register', '/api/auth/me', '/api/auth/logout', '/api/health'];

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export function middleware(req: NextRequest) {
  if (AUTH_PATHS.some((path) => req.nextUrl.pathname.startsWith(path)) || PUBLIC_FILE.test(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get('mess_session_user_id');
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
