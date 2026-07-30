"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function addOrder(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "warehouse", "canCreate");

  const clientName = formData.get("clientName") as string;
  const intermediary = formData.get("intermediary") as string;
  const totalQuantity = parseInt(formData.get("totalQuantity") as string, 10);
  const deliveryLocation = formData.get("deliveryLocation") as string;

  if (!clientName || !intermediary || !totalQuantity || !deliveryLocation) {
    throw new Error("All fields are required.");
  }

  await prisma.order.create({
    data: {
      clientName,
      intermediary,
      totalQuantity,
      deliveryLocation,
      assets: {
        create: Array.from({ length: totalQuantity }, () => ({
          status: "pending",
        })),
      },
    },
  });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard");
  redirect("/dashboard/warehouse");
}

export async function updateOrder(id: string, formData: FormData) {
  const user = await getSession();
  requirePermission(user, "warehouse", "canEdit");

  const clientName = formData.get("clientName") as string;
  const intermediary = formData.get("intermediary") as string;
  const totalQuantity = parseInt(formData.get("totalQuantity") as string, 10);
  const deliveryLocation = formData.get("deliveryLocation") as string;

  if (!clientName || !intermediary || !totalQuantity || !deliveryLocation) {
    throw new Error("All fields are required.");
  }

  const existing = await prisma.order.findUnique({
    where: { id },
    include: { assets: true },
  });
  if (!existing) throw new Error("Order not found.");

  const allocatedCount = existing.assets.filter(a => a.inventoryItemId !== null).length;
  if (totalQuantity < allocatedCount) {
    throw new Error(`Cannot reduce quantity below ${allocatedCount} allocated units.`);
  }

  const currentPending = existing.assets.filter(a => a.inventoryItemId === null).length;
  const diff = totalQuantity - (existing.totalQuantity - currentPending);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },
      data: { clientName, intermediary, totalQuantity, deliveryLocation },
    });

    if (diff > 0) {
      await tx.asset.createMany({
        data: Array.from({ length: diff }, () => ({
          orderId: id,
          status: "pending",
        })),
      });
    } else if (diff < 0) {
      const toRemove = await tx.asset.findMany({
        where: { orderId: id, inventoryItemId: null },
        take: Math.abs(diff),
      });
      await tx.asset.deleteMany({
        where: { id: { in: toRemove.map(a => a.id) } },
      });
    }
  });

  revalidatePath("/dashboard/warehouse");
  redirect("/dashboard/warehouse");
}

export async function deleteOrder(id: string) {
  const user = await getSession();
  requirePermission(user, "warehouse", "canDelete");

  await prisma.order.delete({ where: { id } });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard");
}
