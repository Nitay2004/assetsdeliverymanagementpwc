import { cookies } from "next/headers";
import { prisma } from "./prisma";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "devit_session";
// Short-lived signed cookie that marks "password already checked, waiting on the
// second factor". It never authorises anything on its own — only carries a user
// id to the TOTP verification step, and expires in 5 minutes.
const TWO_FACTOR_PENDING_COOKIE_NAME = "devit_2fa_pending";
const TWO_FACTOR_PENDING_TTL_MS = 5 * 60 * 1000;
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours absolute maximum
// Only touch the DB to slide the expiry when the session is within this much
// time of expiring, instead of writing on every request. The window guarantee
// is preserved: any request made < 15 min after the last slide triggers a
// renewal once remaining time drops below SLIDE_RENEW_MS.
const SLIDE_RENEW_MS = 5 * 60 * 1000;
// Set SESSION_COOKIE_SECURE=true when the app is served over HTTPS. Keep it off
// for plain-HTTP office access so the cookie is still sent.
const SECURE_COOKIE = process.env.SESSION_COOKIE_SECURE === "true";

export async function createSession(userId: string) {
  // Generate a random token
  const token = crypto.randomBytes(32).toString("hex");
  
  // Hash the token before storing it in the database for security
  const hash = crypto.createHash("sha256").update(token).digest("hex");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);

  await prisma.session.create({
    data: {
      userId,
      token: hash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: SECURE_COOKIE,
    sameSite: "lax",
    maxAge: ABSOLUTE_TIMEOUT_MS / 1000, // browser cookie self-cleans within the absolute limit
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.session.deleteMany({
      where: { token: hash },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const hash = crypto.createHash("sha256").update(token).digest("hex");

  const session = await prisma.session.findUnique({
    where: { token: hash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // A disabled account keeps no valid session: revoke every session the user
  // has (covers sessions created before an admin toggled isActive off, which
  // the proxy and getSession would otherwise keep honouring until expiry).
  if (!session.user.isActive) {
    await prisma.session.deleteMany({ where: { userId: session.userId } });
    return null;
  }

  const now = new Date();

  // Absolute timeout — session can live for at most 8 hours after creation,
  // regardless of activity. Stale cookies are harmless: they point to a
  // deleted session, and createSession() overwrites them on next login.
  if (now.getTime() - session.createdAt.getTime() > ABSOLUTE_TIMEOUT_MS) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // Idle timeout — if the session expired due to inactivity, destroy it.
  if (session.expiresAt < now) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // Slide the idle window forward on activity (DB only — cookies can't be
  // modified during a Server Component render). Skip the DB write until the
  // session is close to expiring to cut per-request DB writes. Users who stay
  // active are never logged out because any request within 15 min of the last
  // slide renews the window once remaining time drops below SLIDE_RENEW_MS.
  const remainingMs = session.expiresAt.getTime() - now.getTime();
  if (remainingMs <= SLIDE_RENEW_MS) {
    const nowExpires = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: nowExpires },
    });
  }

  return session.user;
}

// Guard for server actions: returns the logged-in user or throws so the action
// is refused (Server Actions are public POST endpoints and must self-authorize).
export async function requireAuth(): Promise<NonNullable<Awaited<ReturnType<typeof getSession>>>> {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function twoFactorPendingKey(): Buffer {
  return crypto
    .createHash("sha256")
    .update(`devit-2fa-pending:${process.env.TWO_FACTOR_ENCRYPTION_KEY ?? ""}`)
    .digest();
}

function signTwoFactorPending(payload: string): string {
  return crypto.createHmac("sha256", twoFactorPendingKey()).update(payload).digest("base64url");
}

export async function setPendingTwoFactor(userId: string) {
  const expiresAt = Date.now() + TWO_FACTOR_PENDING_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const cookieStore = await cookies();
  cookieStore.set(
    TWO_FACTOR_PENDING_COOKIE_NAME,
    `${payload}.${signTwoFactorPending(payload)}`,
    {
      httpOnly: true,
      secure: SECURE_COOKIE,
      sameSite: "lax",
      maxAge: TWO_FACTOR_PENDING_TTL_MS / 1000,
      path: "/",
    }
  );
}

// Returns the user id awaiting a second factor, or null when the cookie is
// missing, tampered with, or expired.
export async function getPendingTwoFactor(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TWO_FACTOR_PENDING_COOKIE_NAME)?.value;
  if (!raw) return null;

  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = Buffer.from(signTwoFactorPending(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return null;
  }

  const [userId, expiresAt] = payload.split(".");
  if (!userId || !expiresAt) return null;
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) < Date.now()) return null;

  return userId;
}

export async function clearPendingTwoFactor() {
  const cookieStore = await cookies();
  cookieStore.delete(TWO_FACTOR_PENDING_COOKIE_NAME);
}
