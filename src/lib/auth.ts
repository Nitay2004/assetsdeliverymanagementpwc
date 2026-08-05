import { cookies } from "next/headers";
import { prisma } from "./prisma";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "devit_session";
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours absolute maximum

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
    secure: process.env.NODE_ENV === "production",
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

  // Slide the idle window forward on every activity (DB only — cookies can't
  // be modified during a Server Component render).
  const newExpiry = new Date(now.getTime() + IDLE_TIMEOUT_MS);
  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: newExpiry },
  });

  return session.user;
}
