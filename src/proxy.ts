import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { resolveModuleFromPath, canViewModule } from '@/lib/permissions';

const SESSION_COOKIE_NAME = 'devit_session';
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours absolute maximum

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

function deleteCookie(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export async function proxy(request: NextRequest) {
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

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isLoginPage = pathname === "/";

  if (!sessionToken) {
    if (!isLoginPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Validate the session against the DB (proxy runs on the Node.js runtime).
  let session: { expiresAt: Date; createdAt: Date; user: { role: string; permissions: unknown } } | null = null;
  try {
    const hash = crypto.createHash("sha256").update(sessionToken).digest("hex");
    session = await prisma.session.findUnique({
      where: { token: hash },
      select: {
        expiresAt: true,
        createdAt: true,
        user: { select: { role: true, permissions: true } },
      },
    });
  } catch {
    session = null;
  }

  const now = Date.now();
  const isValid =
    !!session &&
    session.expiresAt.getTime() > now &&
    now - session.createdAt.getTime() < ABSOLUTE_TIMEOUT_MS;

  if (!isValid || !session) {
    // Invalid/expired session — drop the cookie and send back to login.
    const response = isLoginPage
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/", request.url));
    return deleteCookie(response);
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Server-side module permission gate (bare /dashboard is always allowed to
  // avoid a redirect loop; client ModuleGuard handles UX there).
  if (pathname !== "/dashboard") {
    const moduleId = resolveModuleFromPath(pathname);
    if (moduleId && !canViewModule(session.user.permissions, session.user.role, moduleId)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.[^/]+$).*)',
  ],
};