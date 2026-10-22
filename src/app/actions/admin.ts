"use server";

import { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getDefaultPermissions,
  type ModuleId,
  type ModulePermission,
  type Permissions,
} from "@/lib/permissions";

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return user;
}

const MODULE_IDS: ModuleId[] = [
  "inventory",
  "assigned-assets",
  "warehouse",
  "provisioning",
  "finance",
  "logistics",
  "reverse-pickup",
  "warranty",
  "product-master",
  "vendor-master",
  "admin",
];

const PERMISSION_FLAGS = ["canView", "canCreate", "canEdit", "canDelete"] as const;

// Permissions arrive from the browser as arbitrary JSON. Validate the exact
// shape instead of persisting whatever was posted: unknown keys and non-boolean
// values are rejected, while missing legacy fields fall back to role defaults.
function sanitizePermissions(input: unknown, role: string | null | undefined): Permissions {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid permissions payload.");
  }

  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!MODULE_IDS.includes(key as ModuleId)) {
      throw new Error(`Unknown permission module "${key}".`);
    }
  }

  const defaults = getDefaultPermissions(role);
  const result = {} as Permissions;
  for (const moduleId of MODULE_IDS) {
    const moduleValue = raw[moduleId];
    if (moduleValue === undefined) {
      // Legacy rows may not contain every module; fill the gap from the role
      // defaults instead of rejecting the whole edit.
      result[moduleId] = defaults[moduleId];
      continue;
    }
    if (!moduleValue || typeof moduleValue !== "object" || Array.isArray(moduleValue)) {
      throw new Error(`Invalid permissions for "${moduleId}".`);
    }
    const source = moduleValue as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      if (!PERMISSION_FLAGS.includes(key as (typeof PERMISSION_FLAGS)[number])) {
        throw new Error(`Unknown permission "${moduleId}.${key}".`);
      }
    }
    const cleaned = {} as ModulePermission;
    for (const flag of PERMISSION_FLAGS) {
      const value = source[flag];
      if (value === undefined) {
        cleaned[flag] = defaults[moduleId][flag];
      } else if (typeof value === "boolean") {
        cleaned[flag] = value;
      } else {
        throw new Error(`Permission "${moduleId}.${flag}" must be true or false.`);
      }
    }
    result[moduleId] = cleaned;
  }
  return result;
}

// Removing the last active admin would lock everyone out of user management.
async function assertAnotherActiveAdmin(userId: string) {
  const remaining = await prisma.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: userId } },
  });
  if (remaining === 0) {
    throw new Error("Cannot remove or disable the last active admin.");
  }
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
  const validRoles = Object.values(UserRole);
  if (role && !validRoles.includes(role as UserRole)) {
    return { success: false, error: "Invalid role." };
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
      role: role as UserRole,
      permissions: getDefaultPermissions(role) as unknown as Prisma.InputJsonValue,
      isActive: true,
    },
  });

  revalidatePath("/dashboard/admin/users");
  // Never return the password hash to the client.
  return { success: true, user: { id: user.id, email: user.email, role: user.role } };
}

export async function updateUser(userId: string, formData: FormData) {
  const currentUser = await requireAdmin();

  const name = formData.get("name") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;
  const isActive = formData.get("isActive") === "true";

  if (role && !Object.values(UserRole).includes(role as UserRole)) {
    return { success: false, error: "Invalid role." };
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return { success: false, error: "User not found." };

  const nextRole = role ? (role as UserRole) : existing.role;
  const roleChanged = nextRole !== existing.role;

  // An admin must not change their own role or disable themselves: either can
  // create an unrecoverable lockout, and both are easy to do by accident.
  if (currentUser.id === userId) {
    if (roleChanged) {
      return { success: false, error: "You cannot change your own role." };
    }
    if (!isActive && existing.isActive) {
      return { success: false, error: "You cannot disable your own account." };
    }
  }

  if (existing.role === "ADMIN" && (nextRole !== "ADMIN" || !isActive)) {
    try {
      await assertAnotherActiveAdmin(userId);
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  const updateData: Record<string, unknown> = {
    name: name || null,
    role: nextRole,
    isActive,
  };

  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }

  if (roleChanged) {
    updateData.permissions = getDefaultPermissions(nextRole) as unknown as Prisma.InputJsonValue;
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
  const currentUser = await requireAdmin();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) return { success: false, error: "User not found." };

  let safePermissions: Permissions;
  try {
    safePermissions = sanitizePermissions(permissions, target.role);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { permissions: safePermissions as unknown as Prisma.InputJsonValue },
  });

  // Permission edits take effect on the next request because sessions are
  // re-read from the DB, but revoking other live sessions is defence in depth.
  if (userId !== currentUser.id) {
    await prisma.session.deleteMany({ where: { userId } });
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const currentUser = await requireAdmin();
  if (currentUser.id === userId) {
    return { success: false, error: "Cannot delete your own account." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: "User not found." };

  if (target.role === "ADMIN" && target.isActive) {
    try {
      await assertAnotherActiveAdmin(userId);
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function toggleUserStatus(userId: string) {
  const currentUser = await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "User not found." };

  if (currentUser.id === userId && user.isActive) {
    return { success: false, error: "You cannot disable your own account." };
  }

  if (user.role === "ADMIN" && user.isActive) {
    try {
      await assertAnotherActiveAdmin(userId);
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

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
  const currentUser = await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: { permissions: getDefaultPermissions(user.role) as unknown as Prisma.InputJsonValue },
  });

  if (userId !== currentUser.id) {
    await prisma.session.deleteMany({ where: { userId } });
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}
