"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function hasPriorDelivery(itemId: string, serialNumber: string): Promise<boolean> {
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

export async function createAssignmentOrder(item: {
  id: string;
  employeeName: string | null;
  entity: string | null;
  city: string | null;
  state: string | null;
}) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        clientName: item.employeeName || item.entity || "Individual Dispatch",
        intermediary: "Direct from Inventory",
        totalQuantity: 1,
        deliveryLocation: [item.city, item.state].filter(Boolean).join(", ") || "N/A",
        status: "ORDER_PLACED",
      },
    });

    await tx.asset.create({
      data: {
        orderId: order.id,
        status: "allocated",
        inventoryItemId: item.id,
      },
    });

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        status: "ALLOCATED",
        trackingStatus: "Order Placed",
      },
    });
  });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard");
}
