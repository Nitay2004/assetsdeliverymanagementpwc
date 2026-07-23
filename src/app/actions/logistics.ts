"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/app/actions/warehouse";

export async function markAsRto(
  orderId: string,
  data: {
    warehouseId: string;
    receivedBy: string;
    rtoDocketNumber: string;
  }
) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    throw new Error("Unauthorized");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) throw new Error("Order not found.");
  if (order.status !== "DISPATCHED") {
    throw new Error("Can only mark as RTO from DISPATCHED status.");
  }

  // Create RTO record
  await prisma.rtoRecord.create({
    data: {
      orderId,
      warehouseId: data.warehouseId,
      receivedBy: data.receivedBy,
      rtoDocketNumber: data.rtoDocketNumber,
      rtoDate: new Date(),
    },
  });

  // Create a new docket for RTO (old one stays)
  await prisma.docket.create({
    data: {
      orderId,
      docketNumber: data.rtoDocketNumber,
    },
  });

  // Update order status
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "RTO" },
  });

  await syncOrderTrackingStatus(orderId, "RTO");

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/inventory");
}

export async function addDocket(formData: FormData) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    throw new Error("Unauthorized");
  }

  const orderId = formData.get("orderId") as string;
  const docketNumber = formData.get("docketNumber") as string;
  const ewayBillNumber = formData.get("ewayBillNumber") as string;
  const podDocumentUrl = formData.get("podDocumentUrl") as string;

  if (!orderId || !docketNumber) {
    throw new Error("Order and docket number are required.");
  }

  await prisma.docket.create({
    data: {
      orderId,
      docketNumber,
      ewayBillNumber: ewayBillNumber || null,
      podDocumentUrl: podDocumentUrl || null,
    },
  });

  const linkedAssets = await prisma.asset.findMany({
    where: { orderId, inventoryItemId: { not: null } },
    select: { inventoryItemId: true },
  });
  const linkedItemIds = linkedAssets.map(a => a.inventoryItemId).filter(Boolean) as string[];
  if (linkedItemIds.length > 0) {
    await prisma.inventoryItem.updateMany({
      where: { id: { in: linkedItemIds } },
      data: { docketNumber },
    });
  }

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/inventory");
}

export async function updateDocket(id: string, formData: FormData) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    throw new Error("Unauthorized");
  }

  const docketNumber = formData.get("docketNumber") as string;
  const ewayBillNumber = formData.get("ewayBillNumber") as string;
  const podDocumentUrl = formData.get("podDocumentUrl") as string;

  if (!docketNumber) throw new Error("Docket number is required.");

  await prisma.docket.update({
    where: { id },
    data: {
      docketNumber,
      ewayBillNumber: ewayBillNumber || null,
      podDocumentUrl: podDocumentUrl || null,
    },
  });

  revalidatePath("/dashboard/logistics");
}

export async function updateDocketPod(docketId: string, podDocumentUrl: string) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    throw new Error("Unauthorized");
  }

  await prisma.docket.update({
    where: { id: docketId },
    data: { podDocumentUrl: podDocumentUrl || null },
  });

  revalidatePath("/dashboard/logistics");
}

export async function deleteDocket(id: string) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    throw new Error("Unauthorized");
  }

  await prisma.docket.delete({ where: { id } });

  revalidatePath("/dashboard/logistics");
}

export async function advanceOrderStatus(orderId: string, status: string) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    throw new Error("Unauthorized");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) throw new Error("Order not found.");

  const allowedNextStatuses: Record<string, string[]> = {
    IN_PROVISIONING: ["DOCKET_ASSIGNED"],
    DOCKET_ASSIGNED: ["DC_REQUESTED"],
    DC_GENERATED: ["EWAY_BILL_REQUESTED"],
    EWAY_BILL_GENERATED: ["PACKED_AND_LABELLED"],
    PACKED_AND_LABELLED: ["DISPATCHED"],
    DISPATCHED: ["DELIVERED", "RTO"],
    RTO: ["RTO_DC_REQUESTED"],
    RTO_DC_REQUESTED: [],
    RTO_DC_GENERATED: ["RTO_EWAY_BILL_REQUESTED"],
    RTO_EWAY_BILL_REQUESTED: [],
    RTO_EWAY_BILL_GENERATED: ["RTO_IN_TRANSIT"],
    RTO_IN_TRANSIT: ["RTO_DELIVERED_TO_WAREHOUSE"],
    RTO_DELIVERED_TO_WAREHOUSE: [],
  };

  const allowed = allowedNextStatuses[order.status];
  if (!allowed || !allowed.includes(status)) {
    throw new Error(`Cannot advance from ${order.status} to ${status}.`);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: status as any },
  });

  await syncOrderTrackingStatus(orderId, status);

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/inventory");
}
