"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/lib/order-sync";
import { isValidOrderStatus, orderTransitionError } from "@/lib/order-status";
import { validateEwayBillNumber } from "@/lib/eway-bill";

export async function markAsRto(
  orderId: string,
  data: {
    warehouseId: string;
    receivedBy: string;
    rtoDocketNumber: string;
  }
) {
  const user = await getSession();
  requirePermission(user, "logistics", "canCreate");

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
  revalidatePath("/dashboard");
}

export async function addDocket(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "logistics", "canCreate");

  const orderId = formData.get("orderId") as string;
  const docketNumber = formData.get("docketNumber") as string;
  const courierName = (formData.get("courierName") as string) || null;
  const ewayBillNumber = (formData.get("ewayBillNumber") as string)?.trim() || "";
  const podDocumentUrl = formData.get("podDocumentUrl") as string;

  if (!orderId || !docketNumber) {
    throw new Error("Order and docket number are required.");
  }

  if (ewayBillNumber) {
    const formatError = validateEwayBillNumber(ewayBillNumber);
    if (formatError) throw new Error(formatError);
    const existing = await prisma.docket.findFirst({
      where: { ewayBillNumber },
    });
    if (existing) {
      throw new Error("E-Way Bill number already exists.");
    }
  }

  const linkedAssets = await prisma.asset.findMany({
    where: { orderId, inventoryItemId: { not: null } },
    select: { inventoryItemId: true },
  });
  const linkedItemIds = linkedAssets.map(a => a.inventoryItemId).filter(Boolean) as string[];

  await prisma.$transaction(async (tx) => {
    await tx.docket.create({
      data: {
        orderId,
        docketNumber,
        courierName,
        ewayBillNumber: ewayBillNumber || null,
        podDocumentUrl: podDocumentUrl || null,
      },
    });
    if (linkedItemIds.length > 0) {
      await tx.inventoryItem.updateMany({
        where: { id: { in: linkedItemIds } },
        data: { docketNumber },
      });
    }
  });

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
}

export async function updateDocket(id: string, formData: FormData) {
  const user = await getSession();
  requirePermission(user, "logistics", "canEdit");

  const docketNumber = formData.get("docketNumber") as string;
  const courierName = (formData.get("courierName") as string) || null;
  const ewayBillNumber = (formData.get("ewayBillNumber") as string)?.trim() || "";
  const podDocumentUrl = formData.get("podDocumentUrl") as string;

  if (!docketNumber) throw new Error("Docket number is required.");

  if (ewayBillNumber) {
    const formatError = validateEwayBillNumber(ewayBillNumber);
    if (formatError) throw new Error(formatError);
    const duplicate = await prisma.docket.findFirst({
      where: { ewayBillNumber, id: { not: id } },
    });
    if (duplicate) throw new Error("E-Way Bill number already exists.");
  }

  await prisma.docket.update({
    where: { id },
    data: {
      docketNumber,
      courierName,
      ewayBillNumber: ewayBillNumber || null,
      podDocumentUrl: podDocumentUrl || null,
    },
  });

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard");
}

export async function updateDocketPod(docketId: string, podDocumentUrl: string) {
  const user = await getSession();
  requirePermission(user, "logistics", "canEdit");

  await prisma.docket.update({
    where: { id: docketId },
    data: { podDocumentUrl: podDocumentUrl || null },
  });

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard");
}

export async function deleteDocket(id: string) {
  const user = await getSession();
  requirePermission(user, "logistics", "canDelete");

  const docket = await prisma.docket.findUnique({
    where: { id },
    select: { ewayBillNumber: true, podDocumentUrl: true, ewayBillDocumentUrl: true },
  });
  if (!docket) throw new Error("Docket not found.");

  // A docket carrying an e-way bill or POD is a compliance record. Deleting it
  // would destroy the only copy of those references.
  if (docket.ewayBillNumber || docket.podDocumentUrl || docket.ewayBillDocumentUrl) {
    throw new Error(
      "This docket carries an e-way bill or POD and cannot be deleted. Remove it from the order only after the records are archived."
    );
  }

  await prisma.docket.delete({ where: { id } });

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard");
}

export async function advanceOrderStatus(orderId: string, status: string) {
  const user = await getSession();
  requirePermission(user, "logistics", "canEdit");

  if (!isValidOrderStatus(status)) {
    throw new Error(`Unknown order status "${status}".`);
  }

  await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction and guard the update on the current status
    // so two concurrent advances cannot both succeed (last-write-wins).
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) throw new Error("Order not found.");

    const transitionError = orderTransitionError(order.status, status);
    if (transitionError) throw new Error(transitionError);

    // A consignment above ₹50,000 must carry an e-way bill before it can be
    // dispatched.
    if (status === "DISPATCHED") {
      const dc = await tx.deliveryChallan.findFirst({
        where: { orderId },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: { taxableValue: true, totalTaxAmount: true },
      });
      const docket = await tx.docket.findFirst({
        where: { orderId },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: { ewayBillNumber: true },
      });
      const consignmentValue =
        (dc?.taxableValue ? Number(dc.taxableValue) : 0) +
        (dc?.totalTaxAmount ? Number(dc.totalTaxAmount) : 0);
      if (consignmentValue > 50000 && !docket?.ewayBillNumber) {
        throw new Error("E-Way Bill is required for consignments above ₹50,000 before dispatch.");
      }
    }

    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: status as any },
    });
    if (updated.count === 0) {
      throw new Error("Order status changed by another user. Please refresh and try again.");
    }
  });

  await syncOrderTrackingStatus(orderId, status);

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard");
}

// ─── Delivery Partner / Courier dropdown (category "courierName") ───

export async function getLogisticsCourierOptions() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const options = await prisma.dropdownOption.findMany({
    where: { category: "courierName" },
    orderBy: { value: "asc" },
  });

  return {
    courierName: options.map(o => o.value),
    allOptions: options.map(o => ({ id: o.id, category: o.category, value: o.value })),
  };
}

export async function addLogisticsCourierOption(value: string) {
  const user = await getSession();
  requirePermission(user, "logistics", "canCreate");

  await prisma.dropdownOption.upsert({
    where: { category_value: { category: "courierName", value } },
    update: {},
    create: { category: "courierName", value },
  });

  revalidatePath("/dashboard/logistics");
}

export async function deleteLogisticsCourierOption(id: string) {
  const user = await getSession();
  requirePermission(user, "logistics", "canDelete");

  await prisma.dropdownOption.delete({ where: { id } });

  revalidatePath("/dashboard/logistics");
}
