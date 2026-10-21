"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { deployedStatus } from "@/lib/inventory-status";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/lib/order-sync";
import { orderTransitionError } from "@/lib/order-status";

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

  // Mark inventory items as deployed to a user. A brand-new asset's first
  // dispatch is "Shipped to User"; anything that has been out before is a
  // redeployment.
  const selected = await prisma.inventoryItem.findMany({
    where: { id: { in: inventoryItemIds } },
    select: { id: true, status: true },
  });
  for (const item of selected) {
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { status: deployedStatus(item.status), trackingStatus: "Allocated" },
    });
  }

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function updateOrderStatus(orderId: string, status: string) {
  const user = await getSession();
  requirePermission(user, "warehouse", "canEdit");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) throw new Error("Order not found.");

  const transitionError = orderTransitionError(order.status, status);
  if (transitionError) throw new Error(transitionError);

  await prisma.order.update({
    where: { id: orderId },
    data: { status: status as any },
  });

  await syncOrderTrackingStatus(orderId, status);
  
  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard");
}
