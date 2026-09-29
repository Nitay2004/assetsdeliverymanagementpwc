"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import {
  buildOtpAuthUri,
  buildOtpQrDataUrl,
  createTotpSecret,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  verifyTotp,
} from "@/lib/two-factor";

async function assertPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

// Step 1 of enrolment: mint a secret, stash it encrypted, and hand back the QR
// the user scans. 2FA stays OFF until the code is confirmed.
export async function startTwoFactorSetupAction() {
  const user = await requireAuth();

  const secret = createTotpSecret();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorSecret: encryptTotpSecret(secret),
      twoFactorEnabled: false,
      twoFactorLastStep: null,
    },
  });

  const otpAuthUri = buildOtpAuthUri(user.email, secret);

  return {
    secret,
    otpAuthUri,
    qrDataUrl: await buildOtpQrDataUrl(otpAuthUri),
  };
}

// Step 2: the scanned app must produce a valid code before 2FA is switched on,
// which also proves the device is set up correctly.
export async function confirmTwoFactorSetupAction(formData: FormData) {
  const user = await requireAuth();
  const code = (formData.get("code") as string) ?? "";

  if (!user.twoFactorSecret) {
    return { error: "Setup expired. Please start again." };
  }

  let verified: ReturnType<typeof verifyTotp>;
  try {
    verified = verifyTotp(code, decryptTotpSecret(user.twoFactorSecret), null);
  } catch (error) {
    console.error("2FA secret could not be decrypted", error);
    return { error: "Two-factor authentication is unavailable. Please contact the administrator." };
  }

  if (!verified.ok) {
    return { error: "That code is not valid. Check your authenticator app and try again." };
  }

  const { codes, hashes } = generateRecoveryCodes();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorLastStep: verified.timeStep },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
  ]);

  return { success: true as const, recoveryCodes: codes };
}

export async function disableTwoFactorAction(formData: FormData) {
  const user = await requireAuth();
  const password = (formData.get("password") as string) ?? "";

  if (!(await assertPassword(user.id, password))) {
    return { error: "Incorrect password." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorLastStep: null,
      },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
  ]);

  return { success: true as const };
}

export async function regenerateRecoveryCodesAction(formData: FormData) {
  const user = await requireAuth();
  const password = (formData.get("password") as string) ?? "";

  if (!user.twoFactorEnabled) {
    return { error: "Two-factor authentication is not enabled." };
  }

  if (!(await assertPassword(user.id, password))) {
    return { error: "Incorrect password." };
  }

  const { codes, hashes } = generateRecoveryCodes();

  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
  ]);

  return { success: true as const, recoveryCodes: codes };
}
