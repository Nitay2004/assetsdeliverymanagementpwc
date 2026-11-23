import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { resolveModuleFromPath, canViewModule } from '@/lib/permissions';

const SESSION_COOKIE_NAME = 'devit_session';
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours absolute maximum

// The only API route that must work without a session: it exists to clear a
// stale/invalid cookie so the user can get back to the login screen. Everything
// else under /api/ is authenticated here before the route handler runs.
const PUBLIC_API_ROUTES = new Set(['/api/auth/clear-session']);

function getClientIp(req: NextRequest): string {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) {
    const first = xfwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const xreal = req.headers.get("x-real-ip")?.trim();
  if (xreal) return xreal;
  return "unknown";
}

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

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000).unref?.();

const UPLOAD_WINDOW = 60 * 1000;
const UPLOAD_MAX = 10;
const GENERAL_WINDOW = 60 * 1000;
const GENERAL_MAX = 120;

function deleteCookie(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

interface SessionAuth {
  expiresAt: Date;
  createdAt: Date;
  user: { role: string; permissions: unknown; isActive: boolean };
}

// Shared by the page gate and the API gate so an expired/absent session can
// never be honoured on one path but rejected on the other.
async function loadValidSession(sessionToken?: string): Promise<SessionAuth | null> {
  if (!sessionToken) return null;

  let session: SessionAuth | null = null;
  try {
    const hash = crypto.createHash("sha256").update(sessionToken).digest("hex");
    session = await prisma.session.findUnique({
      where: { token: hash },
      select: {
        expiresAt: true,
        createdAt: true,
        user: { select: { role: true, permissions: true, isActive: true } },
      },
    });
  } catch {
    session = null;
  }

  if (!session) return null;

  const now = Date.now();
  const isValid =
    session.user.isActive &&
    session.expiresAt.getTime() > now &&
    now - session.createdAt.getTime() < ABSOLUTE_TIMEOUT_MS;

  return isValid ? session : null;
}

export async function proxy(request: NextRequest) {
  const ip = getClientIp(request);
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");

  if (isApiRoute) {
    const isUpload = pathname === "/api/upload" || pathname === "/api/pods/upload";

    const windowMs = isUpload ? UPLOAD_WINDOW : GENERAL_WINDOW;
    const max = isUpload ? UPLOAD_MAX : GENERAL_MAX;
    const key = `api:${isUpload ? "upload" : "general"}:${ip}`;

    if (!getRateLimit(key, max, windowMs)) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)), "Cache-Control": "no-store" } }
      );
    }

    // Route handlers still perform their own module-permission checks; this is
    // the authentication boundary that used to be missing entirely for /api/.
    if (!PUBLIC_API_ROUTES.has(pathname)) {
      const session = await loadValidSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
      if (!session) {
        return deleteCookie(
          NextResponse.json(
            { error: "Unauthorized" },
            { status: 401, headers: { "Cache-Control": "no-store" } }
          )
        );
      }
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

  const session = await loadValidSession(sessionToken);

  if (!session) {
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
