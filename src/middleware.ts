import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for the session cookie
  const sessionToken = request.cookies.get('devit_session')?.value;
  const isLoginPage = request.nextUrl.pathname === '/';

  // If user is NOT logged in and trying to access a protected route (anything other than '/')
  if (!sessionToken && !isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user IS logged in and tries to go to the login page, redirect to dashboard
  if (sessionToken && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
