/**
 * Edge middleware: defense-in-depth route gating (server guards still enforce in
 * every handler). Uses the edge-safe authConfig (no Prisma/bcrypt).
 */
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth/config';

const { auth } = NextAuth(authConfig);

// Authed app sections (UI). API routes enforce via server guards.
const PROTECTED_PREFIXES = ['/dashboard', '/vocabulary', '/grammar', '/homework', '/exercises', '/notes', '/settings'];

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = Boolean(req.auth?.user);
  const role = req.auth?.user?.role;

  const isAdminArea = path.startsWith('/admin') || path.startsWith('/api/admin');
  if (isAdminArea && role !== 'ADMIN') {
    if (!isLoggedIn) {
      const url = new URL('/login', nextUrl);
      url.searchParams.set('callbackUrl', path);
      return NextResponse.redirect(url);
    }
    if (path.startsWith('/api/')) {
      return NextResponse.json({ code: 'forbidden', message: 'Admin only', data: null }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  const needsAuth = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  if (needsAuth && !isLoggedIn) {
    const url = new URL('/login', nextUrl);
    url.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Run on app pages + admin APIs; skip static assets, auth endpoints, PWA files.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)'],
};
