"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

  const uniqueIds = [...new Set(inventoryItemIds)];
  if (uniqueIds.length === 0) return { success: true };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the physical items so two orders cannot be allocated the same asset
      // in parallel. The lock is held until this transaction commits/rolls back.
      await tx.$queryRaw`
        SELECT id FROM inventory_items
        WHERE id IN (${Prisma.join(uniqueIds)})
        FOR UPDATE
      `;

    const pendingAssets = await tx.asset.findMany({
      where: { orderId, inventoryItemId: null, status: "pending" },
    });

    if (uniqueIds.length > pendingAssets.length) {
      throw new Error("Too many items selected for pending assets.");
    }

    const existingActive = await tx.asset.findFirst({
      where: {
        inventoryItemId: { in: uniqueIds },
        order: {
          status: {
            notIn: ["DELIVERED", "DELIVERY_CONFIRMED", "INVOICED", "WARRANTY_UPDATED", "RTO_DELIVERED_TO_WAREHOUSE", "CANCELLED"],
          },
        },
      },
      include: { order: { select: { status: true } } },
    });
    if (existingActive) {
      throw new Error(`One or more items are already assigned to an active order (${existingActive.order.status}).`);
    }

    const selected = await tx.inventoryItem.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, status: true },
    });
    if (selected.length !== uniqueIds.length) {
      throw new Error("One or more selected items no longer exist.");
    }

    // Assign each selected inventory item to a pending asset. The conditional
    // update guarantees a stale/double submit cannot overwrite another one.
    for (let idx = 0; idx < uniqueIds.length; idx++) {
      const updated = await tx.asset.updateMany({
        where: { id: pendingAssets[idx].id, inventoryItemId: null, status: "pending" },
        data: { inventoryItemId: uniqueIds[idx], status: "allocated" },
      });
      if (updated.count === 0) {
        throw new Error("Asset allocation changed while you were saving. Refresh and try again.");
      }
    }

    // Mark inventory items as deployed to a user. A brand-new asset's first
    // dispatch is "Shipped to User"; anything that has been out before is a
    // redeployment.
    for (const item of selected) {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { status: deployedStatus(item.status), trackingStatus: "Allocated" },
      });
    }

      return { success: true as const };
    });

    revalidatePath("/dashboard/warehouse");
    revalidatePath("/dashboard/inventory");
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Allocation failed.",
    };
  }
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
