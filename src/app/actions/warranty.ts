"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function updateItemWarranty(id: string, formData: FormData) {
  const user = await getSession();
  requirePermission(user, "warranty", "canEdit");

  await prisma.inventoryItem.update({
    where: { id },
    data: {
      warrantyPeriod: (formData.get("warrantyPeriod") as string) || null,
      warrantyEndPeriod: parseDate(formData.get("warrantyEndPeriod") as string),
      servicesStartDate: parseDate(formData.get("servicesStartDate") as string),
    },
  });

  revalidatePath("/dashboard/warranty");
}

export async function markOrderWarrantyUpdated(orderId: string) {
  const user = await getSession();
  requirePermission(user, "warranty", "canEdit");

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "WARRANTY_UPDATED" },
  });

  revalidatePath("/dashboard/warranty");
}
