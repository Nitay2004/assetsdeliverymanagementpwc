"use server";

import { prisma } from "@/lib/prisma";
import {
  createSession,
  setPendingTwoFactor,
  getPendingTwoFactor,
  clearPendingTwoFactor,
} from "@/lib/auth";
import {
  decryptTotpSecret,
  hashRecoveryCode,
  isRecoveryCodeShaped,
  verifyTotp,
} from "@/lib/two-factor";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const twoFactorAttempts = new Map<string, { count: number; resetTime: number }>();

const LOGIN_WINDOW = 15 * 60 * 1000;
const LOGIN_MAX = 5;
// A 6-digit TOTP has a 1-in-a-million chance per guess, so cap attempts tightly.
const TWO_FACTOR_WINDOW = 10 * 60 * 1000;
const TWO_FACTOR_MAX = 5;

function registerFailure(map: Map<string, { count: number; resetTime: number }>, key: string, windowMs: number) {
  const now = Date.now();
  const entry = map.get(key);
  if (entry && now < entry.resetTime) entry.count++;
  else map.set(key, { count: 1, resetTime: now + windowMs });
}

function isLockedOut(map: Map<string, { count: number; resetTime: number }>, key: string, max: number): boolean {
  const entry = map.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetTime) {
    map.delete(key);
    return false;
  }
  return entry.count >= max;
}

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (entry && now < entry.resetTime && entry.count >= LOGIN_MAX) {
    return { error: "Too many login attempts. Please try again later." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    registerFailure(loginAttempts, email, LOGIN_WINDOW);
    return { error: "Invalid email or password." };
  }

  if (user.isActive === false) {
    return { error: "Your account is disabled. Please contact the administrator." };
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    registerFailure(loginAttempts, email, LOGIN_WINDOW);
    return { error: "Invalid email or password." };
  }

  loginAttempts.delete(email);

  // Password is correct but a second factor is required: hand off to the OTP
  // step instead of creating a session.
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    twoFactorAttempts.delete(user.id);
    await setPendingTwoFactor(user.id);
    return { needsTwoFactor: true, email: user.email };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function verifyTwoFactorAction(formData: FormData) {
  const code = (formData.get("code") as string) ?? "";
  const useRecoveryCode = formData.get("useRecoveryCode") === "true";

  const userId = await getPendingTwoFactor();
  if (!userId) {
    return { error: "Your sign-in attempt expired. Please enter your password again." };
  }

  if (isLockedOut(twoFactorAttempts, userId, TWO_FACTOR_MAX)) {
    await clearPendingTwoFactor();
    return { error: "Too many verification attempts. Please sign in again." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
    await clearPendingTwoFactor();
    return { error: "Two-factor authentication is not set up for this account." };
  }

  if (useRecoveryCode) {
    if (!isRecoveryCodeShaped(code)) {
      registerFailure(twoFactorAttempts, userId, TWO_FACTOR_WINDOW);
      return { error: "That recovery code is not valid." };
    }

    const stored = await prisma.twoFactorRecoveryCode.findFirst({
      where: { userId: user.id, codeHash: hashRecoveryCode(code), usedAt: null },
    });

    if (!stored) {
      registerFailure(twoFactorAttempts, userId, TWO_FACTOR_WINDOW);
      return { error: "That recovery code is not valid." };
    }

    // Single use: the row is removed the moment it is redeemed.
    await prisma.twoFactorRecoveryCode.delete({ where: { id: stored.id } });

    const remaining = await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } });
    await clearPendingTwoFactor();
    await createSession(user.id);
    redirect(`/dashboard${remaining <= 2 ? "?recovery=low" : ""}`);
  }

  let verified: ReturnType<typeof verifyTotp>;
  try {
    verified = verifyTotp(
      code,
      decryptTotpSecret(user.twoFactorSecret),
      user.twoFactorLastStep
    );
  } catch (error) {
    console.error("2FA secret could not be decrypted", error);
    await clearPendingTwoFactor();
    return { error: "Two-factor authentication is unavailable. Please contact the administrator." };
  }

  if (!verified.ok) {
    registerFailure(twoFactorAttempts, userId, TWO_FACTOR_WINDOW);
    if (verified.reason === "replayed") {
      return { error: "That code was already used. Wait for the next code." };
    }
    return { error: "That code is not valid." };
  }

  // Record the accepted time step so the same code cannot be replayed.
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorLastStep: verified.timeStep },
  });

  await clearPendingTwoFactor();
  await createSession(user.id);
  redirect("/dashboard");
}

export async function cancelTwoFactorAction() {
  await clearPendingTwoFactor();
  return { cancelled: true };
}
