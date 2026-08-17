import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

const UPLOAD_WINDOW = 60 * 1000;
const UPLOAD_MAX = 10;
const GENERAL_WINDOW = 60 * 1000;
const GENERAL_MAX = 120;

export function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/")) {
    const isUpload = pathname === "/api/upload" || pathname === "/api/pods/upload";

    const windowMs = isUpload ? UPLOAD_WINDOW : GENERAL_WINDOW;
    const max = isUpload ? UPLOAD_MAX : GENERAL_MAX;
    const key = `api:${isUpload ? "upload" : "general"}:${ip}`;

    if (!getRateLimit(key, max, windowMs)) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) } }
      );
    }

    return NextResponse.next();
  }

  const sessionToken = request.cookies.get('devit_session')?.value;
  const isLoginPage = request.nextUrl.pathname === '/';

  if (!sessionToken && !isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (sessionToken && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
