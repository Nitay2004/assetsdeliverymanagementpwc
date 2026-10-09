"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDefaultPermissions, type Permissions } from "@/lib/permissions";

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function getUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function createUser(formData: FormData) {
  await requireAdmin();

  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;

  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "A user with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      role: role as any,
      permissions: getDefaultPermissions(role) as any,
      isActive: true,
    },
  });

  revalidatePath("/dashboard/admin/users");
  return { success: true, user };
}

export async function updateUser(userId: string, formData: FormData) {
  await requireAdmin();

  const name = formData.get("name") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;
  const isActive = formData.get("isActive") === "true";

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return { success: false, error: "User not found." };

  const roleChanged = Boolean(role) && role !== existing.role;

  const updateData: Record<string, unknown> = {
    name: name || null,
    role: role as any,
    isActive,
  };

  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }

  if (roleChanged) {
    updateData.permissions = getDefaultPermissions(role) as any;
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  // Security: password change, role change or disabling an account must end
  // every existing session for that user — otherwise old sessions keep their
  // previous privileges for up to 8 hours (absolute session timeout).
  if (password || roleChanged || !isActive) {
    await prisma.session.deleteMany({ where: { userId } });
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function updateUserPermissions(userId: string, permissions: Permissions) {
  await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { permissions: permissions as any },
  });

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  await requireAdmin();

  const currentUser = await getSession();
  if (currentUser?.id === userId) {
    return { success: false, error: "Cannot delete your own account." };
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function toggleUserStatus(userId: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "User not found." };

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  // Disabling an account revokes all of its live sessions immediately.
  if (!updated.isActive) {
    await prisma.session.deleteMany({ where: { userId } });
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function resetUserPermissions(userId: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: { permissions: getDefaultPermissions(user.role) as any },
  });

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}
