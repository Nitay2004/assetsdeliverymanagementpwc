"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/lib/order-sync";

export async function updateOrderFinance(
  orderId: string,
  data: {
    clientName?: string;
    deliveryLocation?: string;
    totalQuantity?: number;
    dcNumber?: string;
    invoiceNumber?: string;
    status?: string;
  }
) {
  const user = await getSession();
  requirePermission(user, "finance", "canEdit");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found.");

  const updateData: Record<string, unknown> = {};
  if (data.clientName !== undefined) updateData.clientName = data.clientName;
  if (data.deliveryLocation !== undefined) updateData.deliveryLocation = data.deliveryLocation;
  if (data.totalQuantity !== undefined) updateData.totalQuantity = data.totalQuantity;
  if (data.dcNumber !== undefined) updateData.dcNumber = data.dcNumber;
  if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber;
  if (data.status !== undefined) updateData.status = data.status;

  await prisma.order.update({
    where: { id: orderId },
    data: updateData,
  });

  if (data.status) {
    await syncOrderTrackingStatus(orderId, data.status);
  }

  revalidatePath("/dashboard/finance");
}

export async function deleteOrder(orderId: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canDelete");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found.");

  await prisma.order.delete({ where: { id: orderId } });

  revalidatePath("/dashboard/finance");
}

export async function generateEwayBill(orderId: string, ewayBillNumber: string, ewayBillDocumentUrl?: string | null) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { dockets: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw new Error("Order not found.");

  const docket = order.dockets[0];
  if (!docket) throw new Error("No docket found for this order.");

  await prisma.docket.update({
    where: { id: docket.id },
    data: { ewayBillNumber, ewayBillDocumentUrl: ewayBillDocumentUrl ?? null },
  });

  const isRto = order.status === "RTO_EWAY_BILL_REQUESTED";
  const targetStatus = isRto ? "RTO_EWAY_BILL_GENERATED" : "EWAY_BILL_GENERATED";

  await prisma.order.update({
    where: { id: orderId },
    data: { status: targetStatus },
  });

  await syncOrderTrackingStatus(orderId, targetStatus);

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/logistics");
}
