import { NextResponse } from 'next/server';
import { isValidSessionToken, SESSION_COOKIE } from '@/lib/auth-session';

const PUBLIC_PATHS = new Set(['/login', '/api/auth/session', '/api/auth/logout']);

export function proxy(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (isValidSessionToken(token)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
