"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateOrderFinance(
  orderId: string,
  data: { dcNumber?: string; invoiceNumber?: string; status?: string }
) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "FINANCE")) {
    throw new Error("Unauthorized");
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found.");

  const updateData: Record<string, unknown> = {};
  if (data.dcNumber !== undefined) updateData.dcNumber = data.dcNumber;
  if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber;
  if (data.status !== undefined) updateData.status = data.status;

  await prisma.order.update({
    where: { id: orderId },
    data: updateData,
  });

  revalidatePath("/dashboard/finance");
}
