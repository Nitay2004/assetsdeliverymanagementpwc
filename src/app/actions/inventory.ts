"use server";

import { prisma } from "@/lib/prisma";
import { getSession, requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/app/actions/warehouse";
import { hasPriorDelivery, createAssignmentOrder } from "@/app/actions/assignment";
import { calculateZone, calculateTier, calculateTatDays, calculateExpectedDeliveryDate, normalizeOdaLocation } from "@/lib/location-utils";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function parseIntValue(value: string | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

export async function addInventoryItem(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "inventory", "canCreate");

  const serialNumber = formData.get("serialNumber") as string;
  const model = formData.get("model") as string;

  if (!serialNumber || !model) {
    throw new Error("Serial number and model are required.");
  }

  const rawTrackingStatus = formData.get("trackingStatus") as string;
  const trackingValue = rawTrackingStatus?.toLowerCase() || "";
  const isDelivered = trackingValue.includes("delivered") || trackingValue.includes("confirmed") || trackingValue.includes("dispatched") || trackingValue.includes("invoiced") || trackingValue.includes("payment") || trackingValue.includes("warranty");
  const hasEmployee = !!(formData.get("employeeName") as string);
  const effectiveStatus = isDelivered || hasEmployee ? "ALLOCATED" : "NEW";

  try {
    await prisma.inventoryItem.create({
      data: {
        serialNumber,
        model,
        partNo: (formData.get("partNo") as string) || null,
        status: effectiveStatus,
        specs: (formData.get("specs") as string) || null,
        partner: (formData.get("partner") as string) || null,
        sr: parseIntValue(formData.get("sr") as string),
        entity: (formData.get("entity") as string) || null,
        userBaseLocation: (formData.get("userBaseLocation") as string) || null,
        imageType: (formData.get("imageType") as string) || null,
        purpose: (formData.get("purpose") as string) || null,
        requestDate: parseDate(formData.get("requestDate") as string),
        count: parseIntValue(formData.get("count") as string),
        employeeName: (formData.get("employeeName") as string) || null,
        emailId: (formData.get("emailId") as string) || null,
        shippingAddress: (formData.get("shippingAddress") as string) || null,
        landMark: (formData.get("landMark") as string) || null,
        city: (formData.get("city") as string) || null,
        state: (formData.get("state") as string) || null,
        pinCode: (formData.get("pinCode") as string) || null,
        mobileNumber: (formData.get("mobileNumber") as string) || null,
        pwcRemarks: (formData.get("pwcRemarks") as string) || null,
        laptopMake: (formData.get("laptopMake") as string) || null,
        laptopModel: (formData.get("laptopModel") as string) || null,
        invoiceProductDescription: (formData.get("invoiceProductDescription") as string) || null,
        description: (formData.get("description") as string) || null,
        emailReceivedHour: (formData.get("emailReceivedHour") as string) || null,
        cutOffStatus: (formData.get("cutOffStatus") as string) || null,
        slaStartDate: parseDate(formData.get("slaStartDate") as string),
        slaState: (formData.get("slaState") as string) || null,
        zone: (formData.get("zone") as string) || null,
        tier: (formData.get("tier") as string) || null,
        odaLocation: normalizeOdaLocation(formData.get("odaLocation") as string),
        tat: (formData.get("tat") as string) || null,
        deliveryTatDays: parseIntValue(formData.get("deliveryTatDays") as string),
        actualDeliveryDate: parseDate(formData.get("actualDeliveryDate") as string),
        slaStatus: (formData.get("slaStatus") as string) || null,
        laptopAcceptanceDate: parseDate(formData.get("laptopAcceptanceDate") as string),
        invoicedQuantity: parseIntValue(formData.get("invoicedQuantity") as string),
        warrantyPeriod: (formData.get("warrantyPeriod") as string) || null,
        warrantyEndPeriod: parseDate(formData.get("warrantyEndPeriod") as string),
        customerInstructionDoc: (formData.get("customerInstructionDoc") as string) || null,
        adaptorAdded: (formData.get("adaptorAdded") as string) || null,
        accessoryHeadsetMouse: (formData.get("accessoryHeadsetMouse") as string) || null,
        stickerColour: (formData.get("stickerColour") as string) || null,
        deliveryDate: parseDate(formData.get("deliveryDate") as string),
        dc: (formData.get("dc") as string) || null,
        vendor: (formData.get("vendor") as string) || null,
        deliveredLocation: (formData.get("deliveredLocation") as string) || null,
        docketNumber: (formData.get("docketNumber") as string) || null,
        trackingStatus: rawTrackingStatus || null,
        trackingSubStatus: (formData.get("trackingSubStatus") as string) || null,
        pickupDate: parseDate(formData.get("pickupDate") as string),
        alternatePhoneNumber: (formData.get("alternatePhoneNumber") as string) || null,
        processStatus: (formData.get("processStatus") as string) || null,
        machineWs1Status: (formData.get("machineWs1Status") as string) || null,
        serialNoInWs1: (formData.get("serialNoInWs1") as string) || null,
        dateOfWs1Update: parseDate(formData.get("dateOfWs1Update") as string),
        servicesStartDate: parseDate(formData.get("servicesStartDate") as string),
        invoicingWarehouse: (formData.get("invoicingWarehouse") as string) || null,
        boxSerialNo: (formData.get("boxSerialNo") as string) || null,
        checkField: (formData.get("checkField") as string) || null,
        remark: (formData.get("remark") as string) || null,
        dcNumber: (formData.get("dcNumber") as string) || null,
        date: parseDate(formData.get("date") as string),
        csvStatus: (formData.get("csvStatus") as string) || null,
        inwardDate1: parseDate(formData.get("inwardDate") as string),
        outwardDate1: parseDate(formData.get("outwardDate") as string),
      },
    });
  } catch (e) {
    if ((e as any)?.code === "P2002") {
      throw new Error("Serial number already exists.");
    }
    throw new Error("Failed to add item.");
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
}

export async function updateInventoryItem(id: string, formData: FormData) {
  const user = await getSession();
  requirePermission(user, "inventory", "canEdit");

  const serialNumber = formData.get("serialNumber") as string;
  const model = formData.get("model") as string;

  if (!serialNumber || !model) {
    throw new Error("Serial number and model are required.");
  }

  const rawTrackingStatus = formData.get("trackingStatus") as string;
  const trackingValue = rawTrackingStatus?.toLowerCase() || "";
  const isDelivered = trackingValue.includes("delivered") || trackingValue.includes("confirmed") || trackingValue.includes("dispatched") || trackingValue.includes("invoiced") || trackingValue.includes("payment") || trackingValue.includes("warranty");

  const current = await prisma.inventoryItem.findUnique({ where: { id }, select: { status: true } });
  let effectiveStatus = current?.status;
  if (isDelivered && effectiveStatus === "AVAILABLE") {
    effectiveStatus = "ALLOCATED";
  }

  try {
    await prisma.inventoryItem.update({
      where: { id },
      data: {
        serialNumber,
        model,
        partNo: (formData.get("partNo") as string) || null,
        specs: (formData.get("specs") as string) || null,
        partner: (formData.get("partner") as string) || null,
        sr: parseIntValue(formData.get("sr") as string),
        entity: (formData.get("entity") as string) || null,
        userBaseLocation: (formData.get("userBaseLocation") as string) || null,
        imageType: (formData.get("imageType") as string) || null,
        purpose: (formData.get("purpose") as string) || null,
        requestDate: parseDate(formData.get("requestDate") as string),
        count: parseIntValue(formData.get("count") as string),
        employeeName: (formData.get("employeeName") as string) || null,
        emailId: (formData.get("emailId") as string) || null,
        shippingAddress: (formData.get("shippingAddress") as string) || null,
        landMark: (formData.get("landMark") as string) || null,
        city: (formData.get("city") as string) || null,
        state: (formData.get("state") as string) || null,
        pinCode: (formData.get("pinCode") as string) || null,
        mobileNumber: (formData.get("mobileNumber") as string) || null,
        pwcRemarks: (formData.get("pwcRemarks") as string) || null,
        laptopMake: (formData.get("laptopMake") as string) || null,
        laptopModel: (formData.get("laptopModel") as string) || null,
        invoiceProductDescription: (formData.get("invoiceProductDescription") as string) || null,
        description: (formData.get("description") as string) || null,
        emailReceivedHour: (formData.get("emailReceivedHour") as string) || null,
        cutOffStatus: (formData.get("cutOffStatus") as string) || null,
        slaStartDate: parseDate(formData.get("slaStartDate") as string),
        slaState: (formData.get("slaState") as string) || null,
        zone: (formData.get("zone") as string) || null,
        tier: (formData.get("tier") as string) || null,
        odaLocation: normalizeOdaLocation(formData.get("odaLocation") as string),
        tat: (formData.get("tat") as string) || null,
        deliveryTatDays: parseIntValue(formData.get("deliveryTatDays") as string),
        actualDeliveryDate: parseDate(formData.get("actualDeliveryDate") as string),
        slaStatus: (formData.get("slaStatus") as string) || null,
        laptopAcceptanceDate: parseDate(formData.get("laptopAcceptanceDate") as string),
        invoicedQuantity: parseIntValue(formData.get("invoicedQuantity") as string),
        warrantyPeriod: (formData.get("warrantyPeriod") as string) || null,
        warrantyEndPeriod: parseDate(formData.get("warrantyEndPeriod") as string),
        customerInstructionDoc: (formData.get("customerInstructionDoc") as string) || null,
        adaptorAdded: (formData.get("adaptorAdded") as string) || null,
        accessoryHeadsetMouse: (formData.get("accessoryHeadsetMouse") as string) || null,
        stickerColour: (formData.get("stickerColour") as string) || null,
        deliveryDate: parseDate(formData.get("deliveryDate") as string),
        dc: (formData.get("dc") as string) || null,
        vendor: (formData.get("vendor") as string) || null,
        deliveredLocation: (formData.get("deliveredLocation") as string) || null,
        docketNumber: (formData.get("docketNumber") as string) || null,
        status: effectiveStatus,
        trackingStatus: rawTrackingStatus || null,
        trackingSubStatus: (formData.get("trackingSubStatus") as string) || null,
        pickupDate: parseDate(formData.get("pickupDate") as string),
        alternatePhoneNumber: (formData.get("alternatePhoneNumber") as string) || null,
        processStatus: (formData.get("processStatus") as string) || null,
        machineWs1Status: (formData.get("machineWs1Status") as string) || null,
        serialNoInWs1: (formData.get("serialNoInWs1") as string) || null,
        dateOfWs1Update: parseDate(formData.get("dateOfWs1Update") as string),
        servicesStartDate: parseDate(formData.get("servicesStartDate") as string),
        invoicingWarehouse: (formData.get("invoicingWarehouse") as string) || null,
        boxSerialNo: (formData.get("boxSerialNo") as string) || null,
        checkField: (formData.get("checkField") as string) || null,
        remark: (formData.get("remark") as string) || null,
        dcNumber: (formData.get("dcNumber") as string) || null,
        date: parseDate(formData.get("date") as string),
        csvStatus: (formData.get("csvStatus") as string) || null,
        inwardDate1: parseDate(formData.get("inwardDate") as string),
        outwardDate1: parseDate(formData.get("outwardDate") as string),
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      throw new Error("Serial number already exists.");
    }
    throw new Error("Failed to update item.");
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  redirect("/dashboard/inventory");
}

export async function deleteInventoryItem(id: string) {
  const user = await getSession();
  requirePermission(user, "inventory", "canDelete");

  try {
    await prisma.inventoryItem.delete({ where: { id } });
  } catch {
    throw new Error("Failed to delete item.");
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
}

export async function returnItemToStock(id: string) {
  const user = await getSession();
  requirePermission(user, "inventory", "canEdit");

  const existing = await prisma.inventoryItem.findUnique({ where: { id } });

  // Save current assignment to history before clearing (skip if already recorded)
  if (existing?.employeeName) {
    const alreadyRecorded = await prisma.assignmentRecord.findFirst({
      where: { inventoryItemId: id, employeeName: existing.employeeName },
    });
    if (!alreadyRecorded) {
      await prisma.assignmentRecord.create({
        data: {
          inventoryItemId: id,
          employeeName: existing.employeeName,
          emailId: existing.emailId,
          mobileNumber: existing.mobileNumber,
          alternatePhoneNumber: existing.alternatePhoneNumber,
          shippingAddress: existing.shippingAddress,
          landMark: existing.landMark,
          city: existing.city,
          state: existing.state,
          pinCode: existing.pinCode,
          purpose: existing.purpose,
          requestDate: existing.requestDate,
          userBaseLocation: existing.userBaseLocation,
          imageType: existing.imageType,
          count: existing.count,
          pwcRemarks: existing.pwcRemarks,
          trackingStatus: existing.trackingStatus,
          trackingSubStatus: existing.trackingSubStatus,
          dcNumber: existing.dcNumber,
          docketNumber: existing.docketNumber,
          deliveryDate: existing.deliveryDate,
          assignedAt: new Date(),
        },
      });
    }
  }

  await prisma.inventoryItem.update({
    where: { id },
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
  revalidatePath("/dashboard");
}

export async function cancelItemAssignment(id: string) {
  const user = await getSession();
  requirePermission(user, "inventory", "canEdit");

  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) throw new Error("Item not found.");
  if (existing.status !== "ALLOCATED") throw new Error("Only allocated items can be cancelled.");

  await prisma.$transaction(async (tx) => {
    if (existing.employeeName) {
      await tx.assignmentRecord.create({
        data: {
          inventoryItemId: id,
          employeeName: existing.employeeName,
          emailId: existing.emailId,
          mobileNumber: existing.mobileNumber,
          alternatePhoneNumber: existing.alternatePhoneNumber,
          shippingAddress: existing.shippingAddress,
          landMark: existing.landMark,
          city: existing.city,
          state: existing.state,
          pinCode: existing.pinCode,
          purpose: existing.purpose,
          requestDate: existing.requestDate,
          userBaseLocation: existing.userBaseLocation,
          imageType: existing.imageType,
          count: existing.count,
          pwcRemarks: existing.pwcRemarks,
          trackingStatus: "Shipment Cancelled",
          dcNumber: existing.dcNumber,
          docketNumber: existing.docketNumber,
          deliveryDate: existing.deliveryDate,
          assignedAt: new Date(),
        },
      });
    }

    await tx.inventoryItem.update({
      where: { id },
      data: {
        status: "AVAILABLE",
        trackingStatus: "Shipment Cancelled",
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

    const asset = await tx.asset.findFirst({
      where: {
        inventoryItemId: id,
        order: { status: { notIn: ["DELIVERED", "DELIVERY_CONFIRMED", "INVOICED", "WARRANTY_UPDATED", "CANCELLED"] } },
      },
      select: { orderId: true },
    });
    if (asset) {
      await tx.order.update({
        where: { id: asset.orderId },
        data: { status: "CANCELLED" },
      });
      await tx.asset.updateMany({
        where: { inventoryItemId: id, orderId: asset.orderId },
        data: { status: "cancelled" },
      });
    }
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard");
}

export async function getDistinctFieldValues() {
  await requireAuth();
  const options = await prisma.dropdownOption.findMany({
    orderBy: { value: "asc" },
  });

  return {
    entities: options.filter((o) => o.category === "entity").map((o) => o.value),
    purposes: options.filter((o) => o.category === "purpose").map((o) => o.value),
    imageTypes: options.filter((o) => o.category === "imageType").map((o) => o.value),
    adaptorAddeds: options.filter((o) => o.category === "adaptorAdded").map((o) => o.value),
    accessoryHeadsetMouses: options.filter((o) => o.category === "accessoryHeadsetMouse").map((o) => o.value),
    stickerColours: options.filter((o) => o.category === "stickerColour").map((o) => o.value),
    warehouseLocations: options.filter((o) => o.category === "warehouseLocation").map((o) => o.value),
    allOptions: options.map((o) => ({ id: o.id, category: o.category, value: o.value })),
  };
}

export async function checkSerialNumber(serialNumber: string) {
  await requireAuth();
  if (!serialNumber.trim()) return { exists: false };
  const item = await prisma.inventoryItem.findUnique({
    where: { serialNumber: serialNumber.trim() },
    select: { id: true },
  });
  return { exists: !!item };
}

export async function seedDropdownOptions() {
  const user = await getSession();
  requirePermission(user, "inventory", "canCreate");

  const [existingEntities, existingPurposes, existingImageTypes, existingAdaptors, existingHeadset, existingStickers, existingWarehouseLocs] = await Promise.all([
    prisma.inventoryItem.groupBy({
      by: ["entity"],
      where: { entity: { not: null } },
    }),
    prisma.inventoryItem.groupBy({
      by: ["purpose"],
      where: { purpose: { not: null } },
    }),
    prisma.inventoryItem.groupBy({
      by: ["imageType"],
      where: { imageType: { not: null } },
    }),
    prisma.inventoryItem.groupBy({
      by: ["adaptorAdded"],
      where: { adaptorAdded: { not: null } },
    }),
    prisma.inventoryItem.groupBy({
      by: ["accessoryHeadsetMouse"],
      where: { accessoryHeadsetMouse: { not: null } },
    }),
    prisma.inventoryItem.groupBy({
      by: ["stickerColour"],
      where: { stickerColour: { not: null } },
    }),
    prisma.inventoryItem.groupBy({
      by: ["invoicingWarehouse"],
      where: { invoicingWarehouse: { not: null } },
    }),
  ]);

  const defaultWarehouseLocs = ["Kolkata", "Bangalore", "Gurgaon"];

  const toInsert = [
    ...existingEntities.map((e) => ({ category: "entity", value: e.entity! })),
    ...existingPurposes.map((p) => ({ category: "purpose", value: p.purpose! })),
    ...existingImageTypes.map((i) => ({ category: "imageType", value: i.imageType! })),
    ...existingAdaptors.map((a) => ({ category: "adaptorAdded", value: a.adaptorAdded! })),
    ...existingHeadset.map((h) => ({ category: "accessoryHeadsetMouse", value: h.accessoryHeadsetMouse! })),
    ...existingStickers.map((s) => ({ category: "stickerColour", value: s.stickerColour! })),
    ...existingWarehouseLocs.map((w) => ({ category: "warehouseLocation", value: w.invoicingWarehouse! })),
    ...defaultWarehouseLocs.map((v) => ({ category: "warehouseLocation", value: v })),
  ];

  for (const { category, value } of toInsert) {
    await prisma.dropdownOption.upsert({
      where: { category_value: { category, value } },
      update: {},
      create: { category, value },
    });
  }
}

export async function addDropdownOption(category: string, value: string) {
  const user = await getSession();
  requirePermission(user, "inventory", "canCreate");

  await prisma.dropdownOption.upsert({
    where: { category_value: { category, value } },
    update: {},
    create: { category, value },
  });

  revalidatePath("/dashboard/inventory");
}

export async function deleteDropdownOption(id: string) {
  const user = await getSession();
  requirePermission(user, "inventory", "canDelete");

  await prisma.dropdownOption.delete({ where: { id } });

  revalidatePath("/dashboard/inventory");
}

export async function getInventoryItem(id: string) {
  const user = await requireAuth();
  requirePermission(user, "inventory", "canView");
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) return null;
  return item;
}

export async function reassignItem(id: string, formData: FormData) {
  const user = await getSession();
  requirePermission(user, "inventory", "canEdit");

  const employeeName = (formData.get("employeeName") as string) || null;
  const emailId = (formData.get("emailId") as string) || null;
  const mobileNumber = (formData.get("mobileNumber") as string) || null;
  const alternatePhoneNumber = (formData.get("alternatePhoneNumber") as string) || null;
  const shippingAddress = (formData.get("shippingAddress") as string) || null;
  const landMark = (formData.get("landMark") as string) || null;
  const city = (formData.get("city") as string) || null;
  const state = (formData.get("state") as string) || null;
  const pinCode = (formData.get("pinCode") as string) || null;
  const purpose = (formData.get("purpose") as string) || null;
  const requestDate = parseDate(formData.get("requestDate") as string);
  const userBaseLocation = (formData.get("userBaseLocation") as string) || null;
  const imageType = (formData.get("imageType") as string) || null;
  const count = parseIntValue(formData.get("count") as string);
  const pwcRemarks = (formData.get("pwcRemarks") as string) || null;
  const partner = (formData.get("partner") as string) || null;
  const sr = parseIntValue(formData.get("sr") as string);
  const entity = (formData.get("entity") as string) || null;

  const emailReceivedHour = (formData.get("emailReceivedHour") as string) || null;
  const cutOffStatus = (formData.get("cutOffStatus") as string) || null;
  const slaStartDate = parseDate(formData.get("slaStartDate") as string);
  const slaState = (formData.get("slaState") as string) || null;
  const zone = calculateZone(city, state);
  const tier = calculateTier(city, state);
  const odaLocation = normalizeOdaLocation(formData.get("odaLocation") as string);
  const tatDays = calculateTatDays(city, state, odaLocation);
  const tat = tatDays === null ? null : String(tatDays);
  const deliveryTatDays = tatDays;
  // Falls back to SLA start date + TAT when the operator left it blank, so the
  // promise date can never silently disagree with the tier it was derived from.
  const expectedDeliveryDate =
    parseDate(formData.get("expectedDeliveryDate") as string) ??
    parseDate(calculateExpectedDeliveryDate(slaStartDate, tatDays));
  const actualDeliveryDate = parseDate(formData.get("actualDeliveryDate") as string);
  const slaStatus = (formData.get("slaStatus") as string) || null;
  const laptopAcceptanceDate = parseDate(formData.get("laptopAcceptanceDate") as string);
  const adaptorAdded = (formData.get("adaptorAdded") as string) || null;
  const accessoryHeadsetMouse = (formData.get("accessoryHeadsetMouse") as string) || null;
  const stickerColour = (formData.get("stickerColour") as string) || null;

  // Always save current assignment to history before applying the new one
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) throw new Error("Item not found.");

  // Save the current assignment data as a history record (preserving tracking status),
  // only if that user is not already recorded for this item.
  if (existing?.employeeName) {
    const alreadyRecorded = await prisma.assignmentRecord.findFirst({
      where: { inventoryItemId: id, employeeName: existing.employeeName },
    });
    if (!alreadyRecorded) {
      await prisma.assignmentRecord.create({
        data: {
          inventoryItemId: id,
          employeeName: existing.employeeName,
          emailId: existing.emailId,
          mobileNumber: existing.mobileNumber,
          alternatePhoneNumber: existing.alternatePhoneNumber,
          shippingAddress: existing.shippingAddress,
          landMark: existing.landMark,
          city: existing.city,
          state: existing.state,
          pinCode: existing.pinCode,
          purpose: existing.purpose,
          requestDate: existing.requestDate,
          userBaseLocation: existing.userBaseLocation,
          imageType: existing.imageType,
          count: existing.count,
          pwcRemarks: existing.pwcRemarks,
          trackingStatus: existing.trackingStatus,
          trackingSubStatus: existing.trackingSubStatus,
          dcNumber: existing.dcNumber,
          docketNumber: existing.docketNumber,
          deliveryDate: existing.deliveryDate,
          assignedAt: new Date(),
        },
      });
    }
  }

  // Record the new assignment only when a user is actually assigned
  if (employeeName) {
    const alreadyRecorded = await prisma.assignmentRecord.findFirst({
      where: { inventoryItemId: id, employeeName },
    });
    if (!alreadyRecorded) {
      await prisma.assignmentRecord.create({
        data: {
          inventoryItemId: id,
          employeeName,
          emailId,
          mobileNumber,
          alternatePhoneNumber,
          shippingAddress,
          landMark,
          city,
          state,
          pinCode,
          purpose,
          requestDate,
          userBaseLocation,
          imageType,
          count,
          pwcRemarks,
        },
      });
    }
  }

  // QC (Clean & Purge) is only required for laptops that were delivered to a user
  // and returned. Fresh/RTO laptops go straight into the allocation flow.
  const wasDelivered = await hasPriorDelivery(existing.id, existing.serialNumber);

  const assignmentFields = {
    employeeName,
    emailId,
    mobileNumber,
    alternatePhoneNumber,
    shippingAddress,
    landMark,
    city,
    state,
    pinCode,
    purpose,
    requestDate,
    userBaseLocation,
    imageType,
    count,
    pwcRemarks,
    partner,
    sr,
    entity,
    zone,
    tier,
    tat,
    deliveryTatDays,
    expectedDeliveryDate,
  };

  if (wasDelivered) {
    await prisma.inventoryItem.update({
      where: { id },
      data: {
        status: "QC_PENDING",
        qcRequestedAt: new Date(),
        qcCleanResult: null,
        qcCleanRemarks: null,
        qcCleanDate: null,
        qcCleanBy: null,
        qcPurgeResult: null,
        qcPurgeRemarks: null,
        qcPurgeDate: null,
        qcPurgeBy: null,
        qcFinalResult: null,
        qcRemarks: null,
        qcCompletedAt: null,
        ...assignmentFields,
      },
    });
  } else {
    await prisma.inventoryItem.update({
      where: { id },
      data: {
        status: "ALLOCATED",
        trackingStatus: "Order Placed",
        ...assignmentFields,
      },
    });
    await createAssignmentOrder({
      id: existing.id,
      employeeName: employeeName || existing.employeeName,
      entity,
      city,
      state,
    });
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard");
}

function safeToDateISO(val: Date | null | undefined): string | null {
  if (!val) return null;
  const t = val.getTime();
  return isNaN(t) ? null : val.toISOString();
}

export async function getAssignmentHistory(itemId: string) {
  const user = await requireAuth();
  requirePermission(user, "inventory", "canView");
  const records = await prisma.assignmentRecord.findMany({
    where: { inventoryItemId: itemId },
    orderBy: { assignedAt: "desc" },
  });
  return records.map((r) => ({
    ...r,
    requestDate: safeToDateISO(r.requestDate),
    deliveryDate: safeToDateISO(r.deliveryDate),
    assignedAt: safeToDateISO(r.assignedAt) ?? "",
  }));
}

export async function sendToWarehouse(inventoryItemIds: string[]) {
  const user = await getSession();
  requirePermission(user, "inventory", "canCreate");

  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: inventoryItemIds }, status: { in: ["AVAILABLE", "ALLOCATED"] } },
  });

  if (items.length === 0) {
    throw new Error("No available or allocated items selected.");
  }

  const alreadyInOrder = await prisma.asset.findFirst({
    where: {
      inventoryItemId: { in: items.map(i => i.id) },
      order: { status: { notIn: ["DELIVERED", "DELIVERY_CONFIRMED", "WARRANTY_UPDATED", "CANCELLED"] } },
    },
    include: { order: { select: { id: true, status: true } } },
  });

  if (alreadyInOrder) {
    throw new Error(`One or more items are already assigned to an active order (${alreadyInOrder.order.status}).`);
  }

  // Create an Order
  const orderName = items.length === 1 
    ? (items[0].employeeName || items[0].entity || "Individual Dispatch") 
    : "Bulk Dispatch Batch";
    
  const orderLocation = items.length === 1 
    ? ([items[0].city, items[0].state].filter(Boolean).join(", ") || "N/A") 
    : "Multiple Locations";

  const order = await prisma.order.create({
    data: {
      clientName: orderName,
      intermediary: "Direct from Inventory",
      totalQuantity: items.length,
      deliveryLocation: orderLocation,
      status: "ORDER_PLACED", // User requested it to start in Pending Allocation
    },
  });

  // Create Asset slots and link to items
  await prisma.asset.createMany({
    data: items.map(item => ({
      orderId: order.id,
      status: "allocated",
      inventoryItemId: item.id,
    })),
  });

  // Update InventoryItems to ALLOCATED
  await prisma.inventoryItem.updateMany({
    where: { id: { in: items.map(i => i.id) } },
    data: { status: "ALLOCATED" },
  });

  await syncOrderTrackingStatus(order.id, "ORDER_PLACED");

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard");
  return { success: true, orderId: order.id };
}

export async function fixInventoryStatusConsistency() {
  const user = await getSession();
  requirePermission(user, "inventory", "canEdit");

  const r1 = await prisma.inventoryItem.updateMany({
    where: { status: "AVAILABLE", employeeName: { not: null } },
    data: { status: "ALLOCATED" },
  });

  const r2 = await prisma.inventoryItem.updateMany({
    where: {
      status: "AVAILABLE",
      OR: [
        { trackingStatus: { contains: "Delivered", mode: "insensitive" } },
        { trackingStatus: { contains: "Dispatched", mode: "insensitive" } },
        { trackingStatus: { contains: "Invoiced", mode: "insensitive" } },
        { trackingStatus: { contains: "Allocated", mode: "insensitive" } },
      ],
    },
    data: { status: "ALLOCATED" },
  });

  const r3 = await prisma.inventoryItem.updateMany({
    where: {
      status: "AVAILABLE",
      assets: { some: { status: "allocated" } },
    },
    data: { status: "ALLOCATED" },
  });

  const total = r1.count + r2.count + r3.count;
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { fixed: total };
}
