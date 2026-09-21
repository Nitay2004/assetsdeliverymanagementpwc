"use server";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

const loginAttempts = new Map<string, { count: number; resetTime: number }>();

const LOGIN_WINDOW = 15 * 60 * 1000;
const LOGIN_MAX = 5;

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
    const e = loginAttempts.get(email);
    if (e && now < e.resetTime) e.count++;
    else loginAttempts.set(email, { count: 1, resetTime: now + LOGIN_WINDOW });
    return { error: "Invalid email or password." };
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    const e = loginAttempts.get(email);
    if (e && now < e.resetTime) e.count++;
    else loginAttempts.set(email, { count: 1, resetTime: now + LOGIN_WINDOW });
    return { error: "Invalid email or password." };
  }

  loginAttempts.delete(email);

  await createSession(user.id);
  redirect("/dashboard");
}
