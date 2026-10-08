"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/lib/order-sync";

export async function allocateInventoryToOrder(
  orderId: string,
  inventoryItemIds: string[]
) {
  const user = await getSession();
  requirePermission(user, "warehouse", "canEdit");
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
    data: { status: "ALLOCATED", trackingStatus: "Allocated" },
  });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function updateOrderStatus(orderId: string, status: string) {
  const user = await getSession();
  requirePermission(user, "warehouse", "canEdit");
  
  await prisma.order.update({
    where: { id: orderId },
    data: { status: status as any },
  });

  await syncOrderTrackingStatus(orderId, status);
  
  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard");
}
