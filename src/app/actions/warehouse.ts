"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const orderStatusTrackingMap: Record<string, string> = {
  ORDER_PLACED: "Order Placed",
  ALLOCATED: "Allocated",
  IN_PROVISIONING: "In Provisioning",
  DOCKET_REQUESTED: "Docket Requested",
  DOCKET_ASSIGNED: "Docket Assigned",
  DC_REQUESTED: "DC Requested",
  DC_GENERATED: "DC Generated",
  PACKED_AND_LABELLED: "Packed & Labelled",
  EWAY_BILL_REQUESTED: "E-way Bill Requested",
  EWAY_BILL_GENERATED: "E-way Bill Generated",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  RTO: "RTO - Return to Origin",
  RTO_DC_REQUESTED: "RTO DC Requested",
  RTO_DC_GENERATED: "RTO DC Generated",
  RTO_EWAY_BILL_REQUESTED: "RTO E-Way Bill Requested",
  RTO_EWAY_BILL_GENERATED: "RTO E-Way Bill Generated",
  DELIVERY_CONFIRMED: "Delivery Confirmed",
  INVOICED: "Invoiced",
  WARRANTY_UPDATED: "Warranty Updated",
};

export async function syncOrderTrackingStatus(orderId: string, orderStatus: string) {
  // Intentionally no permission gate here. Every caller has already checked the
  // permission for the operation that produced this status, so gating this
  // mirror-write on warehouse:canEdit made finance/logistics saves throw
  // *after* the order row was committed — the write landed but the action
  // failed, so the UI never refreshed and the save looked broken.
  const assets = await prisma.asset.findMany({
    where: { orderId, inventoryItemId: { not: null } },
    select: { inventoryItemId: true },
  });

  const itemIds = assets.map(a => a.inventoryItemId).filter(Boolean) as string[];
  if (itemIds.length === 0) return;

  // RTO item received back at the warehouse → return to stock (AVAILABLE)
  if (orderStatus === "RTO_DELIVERED_TO_WAREHOUSE") {
    const items = await prisma.inventoryItem.findMany({ where: { id: { in: itemIds } } });

    // Save the current assignment into history (previous user) before clearing
    for (const item of items) {
      if (!item.employeeName) continue;
      const alreadyRecorded = await prisma.assignmentRecord.findFirst({
        where: { inventoryItemId: item.id, employeeName: item.employeeName },
      });
      if (alreadyRecorded) continue;
      await prisma.assignmentRecord.create({
        data: {
          inventoryItemId: item.id,
          employeeName: item.employeeName,
          emailId: item.emailId,
          mobileNumber: item.mobileNumber,
          alternatePhoneNumber: item.alternatePhoneNumber,
          shippingAddress: item.shippingAddress,
          landMark: item.landMark,
          city: item.city,
          state: item.state,
          pinCode: item.pinCode,
          purpose: item.purpose,
          requestDate: item.requestDate,
          userBaseLocation: item.userBaseLocation,
          imageType: item.imageType,
          count: item.count,
          pwcRemarks: item.pwcRemarks,
          trackingStatus: item.trackingStatus,
          trackingSubStatus: item.trackingSubStatus,
          dcNumber: item.dcNumber,
          docketNumber: item.docketNumber,
          deliveryDate: item.deliveryDate,
          assignedAt: new Date(),
        },
      });
    }

    await prisma.inventoryItem.updateMany({
      where: { id: { in: itemIds } },
      data: {
        status: "AVAILABLE",
        trackingStatus: null,
        trackingSubStatus: null,
        employeeName: null,
        emailId: null,
        mobileNumber: null,
        alternatePhoneNumber: null,
        shippingAddress: null,
        landMark: null,
        city: null,
        state: null,
        pinCode: null,
        purpose: null,
        requestDate: null,
        userBaseLocation: null,
        imageType: null,
        count: null,
        pwcRemarks: null,
        dcNumber: null,
        docketNumber: null,
        deliveryDate: null,
      },
    });
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/warehouse");
    return;
  }

  const trackingStatus = orderStatusTrackingMap[orderStatus] ?? null;

  // Delivery transaction from the app → auto-record the outward date. Each delivery
  // fills the next empty outward slot (outwardDate1 → outwardDate6) so app transactions
  // append on top of the historical dates that came from the Excel upload.
  if (orderStatus === "DELIVERED" || orderStatus === "DELIVERY_CONFIRMED") {
    const now = new Date();
    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        outwardDate1: true,
        outwardDate2: true,
        outwardDate3: true,
        outwardDate4: true,
        outwardDate5: true,
        outwardDate6: true,
      },
    });
    for (const item of items) {
      const dateToSet: Record<string, Date> = { deliveryDate: now };
      if (!item.outwardDate1) dateToSet.outwardDate1 = now;
      else if (!item.outwardDate2) dateToSet.outwardDate2 = now;
      else if (!item.outwardDate3) dateToSet.outwardDate3 = now;
      else if (!item.outwardDate4) dateToSet.outwardDate4 = now;
      else if (!item.outwardDate5) dateToSet.outwardDate5 = now;
      else if (!item.outwardDate6) dateToSet.outwardDate6 = now;
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { trackingStatus, ...dateToSet },
      });
    }
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/warehouse");
    return;
  }

  await prisma.inventoryItem.updateMany({
    where: { id: { in: itemIds } },
    data: { trackingStatus },
  });
}

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
