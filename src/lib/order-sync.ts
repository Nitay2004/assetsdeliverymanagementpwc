import { prisma } from "@/lib/prisma";
import { calculateSlaStatus } from "@/lib/sla-utils";
import { revalidatePath } from "next/cache";

// NOT a "use server" file: this is a shared internal helper, not a server
// action. Keeping it here means it is not exposed as a public POST endpoint —
// every caller (dc/finance/inventory/logistics/provisioning/warehouse actions)
// performs its own session + permission check before invoking it.

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
  RTO_IN_TRANSIT: "RTO In Transit",
  RTO_DELIVERED_TO_WAREHOUSE: "RTO Delivered to Warehouse",
  DELIVERY_CONFIRMED: "Delivery Confirmed",
  INVOICED: "Invoiced",
  WARRANTY_UPDATED: "Warranty Updated",
  CANCELLED: "Cancelled",
};

// Orders in these states no longer hold their asset allocation. Marking the
// Asset rows "released" keeps the history row while freeing the physical item
// for a future order (enforced by the partial unique index on
// assets.inventory_item_id in the database).
const TERMINAL_ORDER_STATUSES = new Set([
  "DELIVERED",
  "DELIVERY_CONFIRMED",
  "INVOICED",
  "WARRANTY_UPDATED",
  "RTO_DELIVERED_TO_WAREHOUSE",
  "CANCELLED",
]);

export async function syncOrderTrackingStatus(orderId: string, orderStatus: string) {
  const assets = await prisma.asset.findMany({
    where: { orderId, inventoryItemId: { not: null } },
    select: { inventoryItemId: true },
  });

  const itemIds = assets.map(a => a.inventoryItemId).filter(Boolean) as string[];

  // Once the order reaches a terminal state it no longer owns these assets.
  // The rows stay for history, but "released" is excluded from the partial
  // unique index so the same physical item can be allocated to a new order.
  if (TERMINAL_ORDER_STATUSES.has(orderStatus)) {
    await prisma.asset.updateMany({
      where: { orderId, status: { not: "released" } },
      data: { status: "released" },
    });
  }

  if (itemIds.length === 0) return;

  // RTO item received back at the warehouse → return to stock
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
        status: "ASSET_RETURN_TO_WAREHOUSE",
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

  const trackingStatus = orderStatusTrackingMap[orderStatus];
  // Never write null over a tracking status the source data already carries.
  // Unknown statuses simply leave the existing value untouched.
  if (!trackingStatus) return;

  // Delivery transaction from the app → auto-record the outward date. Each delivery
  // fills the next empty outward slot (outwardDate1 → outwardDate6) so app transactions
  // append on top of the historical dates that came from the Excel upload.
  if (orderStatus === "DELIVERED" || orderStatus === "DELIVERY_CONFIRMED") {
    const now = new Date();
    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        expectedDeliveryDate: true,
        actualDeliveryDate: true,
        outwardDate1: true,
        outwardDate2: true,
        outwardDate3: true,
        outwardDate4: true,
        outwardDate5: true,
        outwardDate6: true,
      },
    });
    for (const item of items) {
      // Actual Delivery Date is never typed by hand: it is stamped on the day the
      // asset is delivered, and SLA Missed/Met is derived from it. If the order is
      // marked delivered again later, keep the original stamp.
      const actualDelivery = item.actualDeliveryDate ?? now;
      const dateToSet: Record<string, Date> = { deliveryDate: now, actualDeliveryDate: actualDelivery };
      if (!item.outwardDate1) dateToSet.outwardDate1 = now;
      else if (!item.outwardDate2) dateToSet.outwardDate2 = now;
      else if (!item.outwardDate3) dateToSet.outwardDate3 = now;
      else if (!item.outwardDate4) dateToSet.outwardDate4 = now;
      else if (!item.outwardDate5) dateToSet.outwardDate5 = now;
      else if (!item.outwardDate6) dateToSet.outwardDate6 = now;
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          trackingStatus,
          ...dateToSet,
          slaStatus: calculateSlaStatus(actualDelivery, item.expectedDeliveryDate),
        },
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
