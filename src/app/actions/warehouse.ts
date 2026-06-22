"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const orderStatusTrackingMap: Record<string, string> = {
  ORDER_PLACED: "Order Placed",
  ALLOCATED: "Allocated",
  IN_PROVISIONING: "In Provisioning",
  DC_GENERATED: "DC Generated",
  PACKED_AND_LABELLED: "Packed & Labelled",
  DOCKET_ASSIGNED: "Docket Assigned",
  EWAY_BILL_REQUESTED: "E-way Bill Requested",
  EWAY_BILL_GENERATED: "E-way Bill Generated",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  DELIVERY_CONFIRMED: "Delivery Confirmed",
  INVOICED: "Invoiced",
  PAYMENT_RECEIVED: "Payment Received",
  WARRANTY_UPDATED: "Warranty Updated",
};

export async function syncOrderTrackingStatus(orderId: string, orderStatus: string) {
  const assets = await prisma.asset.findMany({
    where: { orderId, inventoryItemId: { not: null } },
    select: { inventoryItemId: true },
  });

  const itemIds = assets.map(a => a.inventoryItemId).filter(Boolean) as string[];
  if (itemIds.length === 0) return;

  const trackingStatus = orderStatusTrackingMap[orderStatus] ?? null;

  await prisma.inventoryItem.updateMany({
    where: { id: { in: itemIds } },
    data: { trackingStatus },
  });
}

export async function allocateInventoryToOrder(
  orderId: string,
  inventoryItemIds: string[]
) {
  // Fetch the order's assets that are still pending (not yet allocated)
  const pendingAssets = await prisma.asset.findMany({
    where: { orderId, inventoryItemId: null, status: "pending" },
  });

  if (inventoryItemIds.length > pendingAssets.length) {
    return { success: false, error: "Too many items selected for pending assets." };
  }

  // Assign each selected inventory item to a pending asset
  await Promise.all(
    inventoryItemIds.map((itemId, idx) =>
      prisma.asset.update({
        where: { id: pendingAssets[idx].id },
        data: { inventoryItemId: itemId, status: "allocated" },
      })
    )
  );

  // Mark inventory items as ALLOCATED
  await prisma.inventoryItem.updateMany({
    where: { id: { in: inventoryItemIds } },
    data: { status: "ALLOCATED" },
  });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function updateOrderStatus(orderId: string, status: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  
  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  await syncOrderTrackingStatus(orderId, status);
  
  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard");
}
