"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { orderTransitionError } from "@/lib/order-status";
import { syncOrderTrackingStatus } from "@/lib/order-sync";

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

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) throw new Error("Order not found.");

  // Warranty is the last legal step of the forward lifecycle, so it can only be
  // recorded once the order has been invoiced — a caller cannot jump an order
  // straight from dispatched/cancelled into WARRANTY_UPDATED.
  const transitionError = orderTransitionError(order.status, "WARRANTY_UPDATED");
  if (transitionError) throw new Error(transitionError);

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "WARRANTY_UPDATED" },
  });

  await syncOrderTrackingStatus(orderId, "WARRANTY_UPDATED");

  revalidatePath("/dashboard/warranty");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}
