"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function hasPriorDelivery(itemId: string, serialNumber: string): Promise<boolean> {
  await requireAuth();
  const [item, fromAssignment, fromAsset, fromDeliveryRecord] = await Promise.all([
    prisma.inventoryItem.findUnique({
      where: { id: itemId },
      select: { deliveryDate: true, actualDeliveryDate: true },
    }),
    prisma.assignmentRecord.findFirst({
      where: { inventoryItemId: itemId, deliveryDate: { not: null } },
      select: { id: true },
    }),
    prisma.asset.findFirst({
      where: {
        inventoryItemId: itemId,
        order: { status: { in: ["DELIVERED", "DELIVERY_CONFIRMED"] } },
      },
      select: { id: true },
    }),
    prisma.deliveryRecord.findFirst({
      where: { serialNumber },
      select: { id: true },
    }),
  ]);

  return Boolean(
    item?.deliveryDate ||
      item?.actualDeliveryDate ||
      fromAssignment ||
      fromAsset ||
      fromDeliveryRecord
  );
}

export async function markItemAllocated(id: string) {
  const user = await requireAuth();
  requirePermission(user, "inventory", "canEdit");

  // Assigning a user only reserves the asset. The ORDER_PLACED order that
  // parks it in the warehouse pending-allocation queue is created by Send to
  // Warehouse, so a bulk send never collides with an order that assignment
  // used to create on its own.
  await prisma.inventoryItem.update({
    where: { id },
    data: {
      status: "ALLOCATED",
      trackingStatus: "Order Placed",
    },
  });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard");
}
