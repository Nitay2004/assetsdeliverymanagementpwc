"use server";

import { prisma } from "@/lib/prisma";
import { getSession, requireAuth } from "@/lib/auth";
import { requirePermission, canModuleAction } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { hasPriorDelivery, createAssignmentOrder } from "@/app/actions/assignment";

function requireQcWorkPermission(
  user: { permissions: unknown; role: string } | null
): void {
  if (!user) throw new Error("Unauthorized");
  const canWarehouse = canModuleAction(user.permissions, user.role, "warehouse", "canEdit");
  const canProvisioning = canModuleAction(user.permissions, user.role, "provisioning", "canEdit");
  if (!canWarehouse && !canProvisioning) {
    throw new Error("Permission denied");
  }
}

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

async function recordAssignmentHistory(
  inventoryItemId: string,
  data: {
    employeeName: string | null;
    emailId: string | null;
    mobileNumber: string | null;
    alternatePhoneNumber: string | null;
    shippingAddress: string | null;
    landMark: string | null;
    city: string | null;
    state: string | null;
    pinCode: string | null;
    purpose: string | null;
    requestDate: Date | null;
    userBaseLocation: string | null;
    imageType: string | null;
    count: number | null;
    pwcRemarks: string | null;
    trackingStatus: string | null;
    trackingSubStatus: string | null;
    dcNumber: string | null;
    docketNumber: string | null;
    deliveryDate: Date | null;
  }
) {
  const alreadyRecorded = await prisma.assignmentRecord.findFirst({
    where: { inventoryItemId, employeeName: data.employeeName ?? undefined },
  });
  if (alreadyRecorded) return;
  await prisma.assignmentRecord.create({
    data: {
      inventoryItemId,
      assignedAt: new Date(),
      ...data,
    },
  });
}

export async function sendToQc(id: string, formData: FormData) {
  const user = await getSession();
  requirePermission(user, "inventory", "canEdit");

  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) throw new Error("Item not found.");
  if (existing.status !== "AVAILABLE") {
    throw new Error("Only items with AVAILABLE status can be sent for QC.");
  }

  // QC (Clean & Purge) is only for laptops that were delivered to a user and returned.
  // Fresh/RTO laptops must not be sent for QC.
  const wasDelivered = await hasPriorDelivery(existing.id, existing.serialNumber);
  if (!wasDelivered) {
    throw new Error(
      "QC is only required for laptops returned after delivery. This asset was never delivered, so assign it directly instead of sending for QC."
    );
  }

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
  const zone = (formData.get("zone") as string) || null;
  const tier = (formData.get("tier") as string) || null;
  const odaLocation = (formData.get("odaLocation") as string) || null;
  const tat = (formData.get("tat") as string) || null;
  const deliveryTatDays = parseIntValue(formData.get("deliveryTatDays") as string);
  const expectedDeliveryDate = parseDate(formData.get("expectedDeliveryDate") as string);
  const actualDeliveryDate = parseDate(formData.get("actualDeliveryDate") as string);
  const slaStatus = (formData.get("slaStatus") as string) || null;
  const laptopAcceptanceDate = parseDate(formData.get("laptopAcceptanceDate") as string);
  const adaptorAdded = (formData.get("adaptorAdded") as string) || null;
  const accessoryHeadsetMouse = (formData.get("accessoryHeadsetMouse") as string) || null;
  const stickerColour = (formData.get("stickerColour") as string) || null;

  if (existing.employeeName) {
    await recordAssignmentHistory(existing.id, {
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
    });
  }

  if (employeeName) {
    await recordAssignmentHistory(existing.id, {
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
      trackingStatus: null,
      trackingSubStatus: null,
      dcNumber: null,
      docketNumber: null,
      deliveryDate: null,
    });
  }

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
      emailReceivedHour,
      cutOffStatus,
      slaStartDate,
      slaState,
      zone,
      tier,
      odaLocation,
      tat,
      deliveryTatDays,
      expectedDeliveryDate,
      actualDeliveryDate,
      slaStatus,
      laptopAcceptanceDate,
      adaptorAdded,
      accessoryHeadsetMouse,
      stickerColour,
    },
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard");
}

export async function assignQcEngineer(
  id: string,
  data: { engineerName: string; warehouseLocation: string; qcLocation: string }
) {
  const user = await getSession();
  requirePermission(user, "warehouse", "canEdit");

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.status !== "QC_PENDING") {
    throw new Error("Item is not in QC queue.");
  }
  if (!data.engineerName) {
    throw new Error("QC engineer name is required.");
  }

  await prisma.inventoryItem.update({
    where: { id },
    data: {
      qcEngineer: data.engineerName,
      qcAssignedAt: new Date(),
      invoicingWarehouse: data.warehouseLocation || item.invoicingWarehouse,
      qcLocation: data.qcLocation || item.qcLocation,
    },
  });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
}

export async function getQcDropdowns() {
  await requireAuth();
  const options = await prisma.dropdownOption.findMany({
    where: {
      category: { in: ["warehouseLocation", "engineerName"] },
    },
    orderBy: { value: "asc" },
  });

  const warehouseLocations = options.filter(o => o.category === "warehouseLocation").map(o => o.value);

  return {
    warehouseLocations,
    qcLocations: warehouseLocations,
    engineerNames: options.filter(o => o.category === "engineerName").map(o => o.value),
    allOptions: options.map(o => ({ id: o.id, category: o.category, value: o.value })),
  };
}

export async function addQcDropdownOption(category: string, value: string) {
  const user = await getSession();
  requirePermission(user, "warehouse", "canEdit");

  await prisma.dropdownOption.upsert({
    where: { category_value: { category, value } },
    update: {},
    create: { category, value },
  });

  revalidatePath("/dashboard/warehouse");
}

export async function deleteQcDropdownOption(id: string) {
  const user = await getSession();
  requirePermission(user, "warehouse", "canEdit");

  await prisma.dropdownOption.delete({ where: { id } });

  revalidatePath("/dashboard/warehouse");
}

export async function getQcItemLocations(itemId: string) {
  await requireAuth();
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: { invoicingWarehouse: true, qcLocation: true },
  });
  if (!item) return { warehouseLocation: "", qcLocation: "" };

  return {
    warehouseLocation: item.invoicingWarehouse ?? "",
    qcLocation: item.qcLocation ?? item.invoicingWarehouse ?? "",
  };
}

export async function recordQcClean(id: string, formData: FormData) {
  const user = await getSession();
  requireQcWorkPermission(user);

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.status !== "QC_PENDING") {
    throw new Error("Item is not in QC queue.");
  }

  const qcCleanResult = formData.get("qcCleanResult") as string;
  if (!["PASS", "FAIL"].includes(qcCleanResult)) {
    throw new Error("Invalid Clean QC result.");
  }

  await prisma.inventoryItem.update({
    where: { id },
    data: {
      qcCleanResult,
      qcCleanRemarks: (formData.get("qcCleanRemarks") as string) || null,
      qcCleanDate: parseDate(formData.get("qcCleanDate") as string) ?? new Date(),
      qcCleanBy: item.qcEngineer || (formData.get("qcCleanBy") as string) || null,
    },
  });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/provisioning");
}

export async function recordQcPurge(id: string, formData: FormData) {
  const user = await getSession();
  requireQcWorkPermission(user);

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.status !== "QC_PENDING") {
    throw new Error("Item is not in QC queue.");
  }

  const qcPurgeResult = formData.get("qcPurgeResult") as string;
  if (!["PASS", "FAIL"].includes(qcPurgeResult)) {
    throw new Error("Invalid Purge QC result.");
  }

  await prisma.inventoryItem.update({
    where: { id },
    data: {
      qcPurgeResult,
      qcPurgeRemarks: (formData.get("qcPurgeRemarks") as string) || null,
      qcPurgeDate: parseDate(formData.get("qcPurgeDate") as string) ?? new Date(),
      qcPurgeBy: item.qcEngineer || (formData.get("qcPurgeBy") as string) || null,
    },
  });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/provisioning");
}

export async function completeQc(id: string, finalRemarks?: string) {
  const user = await getSession();
  requireQcWorkPermission(user);

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.status !== "QC_PENDING") {
    throw new Error("Item is not in QC queue.");
  }
  if (!item.qcCleanResult || !item.qcPurgeResult) {
    throw new Error("Both Clean and Purge QC results are required before completing.");
  }

  const cleanPass = item.qcCleanResult === "PASS";
  const purgePass = item.qcPurgeResult === "PASS";

  if (cleanPass && purgePass) {
    await createAssignmentOrder({
      id: item.id,
      employeeName: item.employeeName,
      entity: item.entity,
      city: item.city,
      state: item.state,
    });
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        qcFinalResult: "PASS",
        qcRemarks: finalRemarks || null,
        qcCompletedAt: new Date(),
      },
    });
  } else {
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        status: "DEFECTIVE",
        qcFinalResult: "FAIL",
        qcRemarks:
          finalRemarks ||
          [item.qcCleanRemarks, item.qcPurgeRemarks].filter(Boolean).join("; ") ||
          null,
        qcCompletedAt: new Date(),
      },
    });
  }

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard");
}
