"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

export async function getReversePickupRequests() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const requests = await prisma.reversePickupRequest.findMany({
    orderBy: { createdAt: "desc" },
  });

  return requests;
}

export async function getReversePickupRequest(id: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  return prisma.reversePickupRequest.findUnique({ where: { id } });
}

export async function createReversePickupRequest(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  requirePermission(user, "reverse-pickup", "canCreate");

  const serialNumber = formData.get("serialNumber") as string;
  const model = formData.get("model") as string;
  const employeeName = formData.get("employeeName") as string;
  const pickupAddress = formData.get("pickupAddress") as string;

  if (!serialNumber || !model || !employeeName || !pickupAddress) {
    throw new Error("Serial number, model, employee name, and pickup address are required.");
  }

  const count = await prisma.reversePickupRequest.count();
  const requestNumber = `RPU-${String(count + 1).padStart(4, "0")}`;

  const year = formData.get("year") as string;
  const currentYear = year ? parseIntValue(year) : new Date().getFullYear();

  await prisma.reversePickupRequest.create({
    data: {
      requestNumber,
      serialNumber,
      model,

      // Request Info
      year: currentYear,
      type: (formData.get("type") as string) || null,
      srNo: (formData.get("srNo") as string) || null,
      requestDateHp: parseDate(formData.get("requestDateHp") as string),
      employeeId: (formData.get("employeeId") as string) || null,
      alternateId: (formData.get("alternateId") as string) || null,
      lastWorkingDay: parseDate(formData.get("lastWorkingDay") as string),

      // User Details
      employeeName,
      emailId: (formData.get("emailId") as string) || null,
      mobileNumber: (formData.get("mobileNumber") as string) || null,
      contact: (formData.get("contact") as string) || null,

      // Asset
      entity: (formData.get("entity") as string) || null,
      imageType: (formData.get("imageType") as string) || null,
      accessories: (formData.get("accessories") as string) || null,
      reason: (formData.get("reason") as string) || null,

      // Location
      pickupAddress,
      landmark: (formData.get("landmark") as string) || null,
      city: (formData.get("city") as string) || null,
      state: (formData.get("state") as string) || null,
      pinCode: (formData.get("pinCode") as string) || null,

      // Warehouse / Logistics
      warehouseLocation: (formData.get("warehouseLocation") as string) || null,
      receiverSerialNo: (formData.get("receiverSerialNo") as string) || null,
      receiverSnEntity: (formData.get("receiverSnEntity") as string) || null,
      displayStatus: (formData.get("displayStatus") as string) || null,
      eta: parseDate(formData.get("eta") as string),
      futureDatePickup: parseDate(formData.get("futureDatePickup") as string),
      dependency: (formData.get("dependency") as string) || null,
      remarks: (formData.get("remarks") as string) || null,

      // SLA / TAT
      emailReceivedHour: (formData.get("emailReceivedHour") as string) || null,
      cutOffStatus: (formData.get("cutOffStatus") as string) || null,
      slaStartDate: parseDate(formData.get("slaStartDate") as string),
      slaState: (formData.get("slaState") as string) || null,
      zone1: (formData.get("zone1") as string) || null,
      tier1: (formData.get("tier1") as string) || null,
      odaLocation: (formData.get("odaLocation") as string) || null,
      tat: (formData.get("tat") as string) || null,
      deliveryTat: (formData.get("deliveryTat") as string) || null,
      actualDeliveryPodDate: parseDate(formData.get("actualDeliveryPodDate") as string),
      sla: (formData.get("sla") as string) || null,
      laptopAcceptanceDate: parseDate(formData.get("laptopAcceptanceDate") as string),

      // Courier / Tracking
      courierName: (formData.get("courierName") as string) || null,
      docketNumber: (formData.get("docketNumber") as string) || null,
      pickupDate: parseDate(formData.get("pickupDate") as string),
      dcNo: (formData.get("dcNo") as string) || null,
      srnNo: (formData.get("srnNo") as string) || null,
      eWayBillNo: (formData.get("eWayBillNo") as string) || null,
      etaForUnitReceived: parseDate(formData.get("etaForUnitReceived") as string),
      caseAge: (formData.get("caseAge") as string) || null,

      // Blancco
      blanccoYesNo: (formData.get("blanccoYesNo") as string) || null,
      blanccoDate: parseDate(formData.get("blanccoDate") as string),

      // Case Info
      caseId: (formData.get("caseId") as string) || null,
      issueReported: (formData.get("issueReported") as string) || null,
      replacementPart: (formData.get("replacementPart") as string) || null,
      exceptionRemarks: (formData.get("exceptionRemarks") as string) || null,
      remark: (formData.get("remark") as string) || null,

      createdBy: user.name || user.email || null,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
  redirect("/dashboard/reverse-pickup");
}

export async function assignPartner(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const partnerName = formData.get("partnerName") as string;
  const partnerReference = formData.get("partnerReference") as string;

  if (!id || !partnerName) throw new Error("Request ID and partner name are required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "PARTNER_ASSIGNED",
      partnerName,
      partnerReference: partnerReference || null,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function requestDocket(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Request ID is required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: { status: "DOCKET_REQUESTED" },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function requestDc(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Request ID is required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: { status: "DC_REQUESTED" },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function requestEwayBill(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Request ID is required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: { status: "EWAY_BILL_REQUESTED" },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function recordInspection(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const inspectionRemarks = formData.get("inspectionRemarks") as string;
  const inspectionDate = parseDate(formData.get("inspectionDate") as string);

  if (!id) throw new Error("Request ID is required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "INSPECTED",
      inspectionRemarks: inspectionRemarks || null,
      inspectionDate,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function markAsPickedUp(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const pickupDate = parseDate(formData.get("pickupDate") as string);
  const docketNumber = formData.get("docketNumber") as string;

  if (!id) throw new Error("Request ID is required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "PICKED_UP",
      pickupDate,
      docketNumber: docketNumber || null,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function receiveAtWarehouse(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const warehouseLocation = formData.get("warehouseLocation") as string;
  const receivedDate = parseDate(formData.get("receivedDate") as string);
  const receivedBy = formData.get("receivedBy") as string;

  if (!id || !warehouseLocation) throw new Error("Request ID and warehouse location are required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "RECEIVED_AT_WAREHOUSE",
      warehouseLocation,
      receivedDate,
      receivedBy: receivedBy || null,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function recordQc(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const qcResult = formData.get("qcResult") as string;
  const qcRemarks = formData.get("qcRemarks") as string;
  const qcDate = parseDate(formData.get("qcDate") as string);
  const qcPerformedBy = formData.get("qcPerformedBy") as string;

  if (!id || !qcResult) throw new Error("Request ID and QC result are required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "QC_COMPLETED",
      qcResult,
      qcRemarks: qcRemarks || null,
      qcDate,
      qcPerformedBy: qcPerformedBy || null,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function uploadBlancoCertificate(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const blancoCertificateUrl = formData.get("blancoCertificateUrl") as string;
  const blancoCertificateDate = parseDate(formData.get("blancoCertificateDate") as string);

  if (!id || !blancoCertificateUrl) throw new Error("Request ID and certificate URL are required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "BLANCO_CERTIFIED",
      blancoCertificateUrl,
      blancoCertificateDate,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function completeReversePickup(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const finalDisposition = formData.get("finalDisposition") as string;
  const inventoryItemId = formData.get("inventoryItemId") as string;

  if (!id || !finalDisposition) throw new Error("Request ID and final disposition are required.");

  const updateData: Record<string, string | null> = {
    status: "COMPLETED",
    finalDisposition,
  };

  if (inventoryItemId) {
    updateData.inventoryItemId = inventoryItemId;
  }

  if (finalDisposition === "RESTOCKED" && inventoryItemId) {
    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { status: "AVAILABLE" },
    });
  } else if (finalDisposition === "DEFECTIVE" && inventoryItemId) {
    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { status: "DEFECTIVE" },
    });
  } else if (finalDisposition === "RETIRED" && inventoryItemId) {
    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { status: "RETIRED" },
    });
  }

  await prisma.reversePickupRequest.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/dashboard/reverse-pickup");
  revalidatePath("/dashboard/inventory");
}

// ─── Logistics / Finance handover actions ───

export async function assignReversePickupDocket(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const docketNumber = formData.get("docketNumber") as string;
  if (!id || !docketNumber) throw new Error("Request ID and docket number are required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: { docketNumber, status: "INSPECTED" },
  });

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/reverse-pickup");
}

export async function generateReversePickupEwayBill(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const eWayBillNo = formData.get("eWayBillNo") as string;
  if (!id || !eWayBillNo) throw new Error("Request ID and e-way bill number are required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: { eWayBillNo, status: "EWAY_BILL_GENERATED" },
  });

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/reverse-pickup");
}

export async function deleteReversePickupRequest(id: string) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canDelete");

  await prisma.reversePickupRequest.delete({ where: { id } });
  revalidatePath("/dashboard/reverse-pickup");
}

export async function lookupInventoryBySerial(serialNumber: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  if (!serialNumber || serialNumber.trim().length === 0) return null;

  const item = await prisma.inventoryItem.findUnique({
    where: { serialNumber: serialNumber.trim() },
    select: {
      model: true,
      entity: true,
      imageType: true,
      employeeName: true,
      emailId: true,
      mobileNumber: true,
      shippingAddress: true,
      landMark: true,
      city: true,
      state: true,
      pinCode: true,
      adaptorAdded: true,
      accessoryHeadsetMouse: true,
      stickerColour: true,
    },
  });

  return item;
}

// ─── Dropdown management (synced via DropdownOption table) ───

const RP_CATEGORIES = [
  "type", "entity", "imageType", "reason",
  "warehouseLocation", "displayStatus", "dependency",
  "courierName", "blanccoYesNo", "partnerName", "disposition",
];

export async function getReversePickupDropdowns() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const options = await prisma.dropdownOption.findMany({
    where: { category: { in: RP_CATEGORIES } },
    orderBy: { value: "asc" },
  });

  return {
    type: options.filter(o => o.category === "type").map(o => o.value),
    entity: options.filter(o => o.category === "entity").map(o => o.value),
    imageType: options.filter(o => o.category === "imageType").map(o => o.value),
    reason: options.filter(o => o.category === "reason").map(o => o.value),
    warehouseLocation: options.filter(o => o.category === "warehouseLocation").map(o => o.value),
    displayStatus: options.filter(o => o.category === "displayStatus").map(o => o.value),
    dependency: options.filter(o => o.category === "dependency").map(o => o.value),
    courierName: options.filter(o => o.category === "courierName").map(o => o.value),
    blanccoYesNo: options.filter(o => o.category === "blanccoYesNo").map(o => o.value),
    partnerName: options.filter(o => o.category === "partnerName").map(o => o.value),
    disposition: options.filter(o => o.category === "disposition").map(o => o.value),
    allOptions: options.map(o => ({ id: o.id, category: o.category, value: o.value })),
  };
}

export async function addReversePickupDropdownOption(category: string, value: string) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canCreate");

  await prisma.dropdownOption.upsert({
    where: { category_value: { category, value } },
    update: {},
    create: { category, value },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function deleteReversePickupDropdownOption(id: string) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canDelete");

  await prisma.dropdownOption.delete({ where: { id } });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function seedReversePickupDropdowns() {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canCreate");

  const { SEED_CATEGORIES } = await import("@/lib/reverse-pickup-config");

  for (const [category, entries] of Object.entries(SEED_CATEGORIES)) {
    await prisma.dropdownOption.createMany({
      data: entries.map((entry) => ({ category, value: entry.value })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/dashboard/reverse-pickup");
}
