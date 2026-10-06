"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission, canModuleAction } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeOdaLocation } from "@/lib/location-utils";
import { resolveReversePickupSla } from "@/lib/reverse-pickup-sla";
import { nextSequenceNumber } from "@/lib/sequence-number";

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

const RPU_NUMBER = /^RPU-([0-9]+)$/;

async function nextReversePickupRequestNumber(): Promise<string> {
  const seq = await nextSequenceNumber({
    table: "reverse_pickup_requests",
    column: "requestNumber",
    valuePattern: RPU_NUMBER,
  });

  return `RPU-${String(seq).padStart(4, "0")}`;
}

/**
 * Re-derives the SLA/TAT chain for a stored request. Workflow actions call this
 * whenever they change an input the chain depends on, so a request that was
 * created before the location or email hour was known still ends up with a
 * correct SLA. The stored expected date is *not* fed back in as an override — it
 * is always recomputed from the current city/state/ODA, otherwise a later change
 * of any of those would leave it stale.
 *
 * A record with no stored SLA start date (raised before this logic existed, or
 * with an unusable email hour) is anchored on the day the request was created,
 * not on today, so the expected date stays put instead of sliding forward on
 * every recompute.
 */
async function recomputeSlaForRequest(
  id: string,
  overrides: {
    pickupDate?: Date | null;
    emailReceivedHour?: string | null;
    city?: string | null;
    state?: string | null;
    odaLocation?: string | null;
  } = {}
) {
  const existing = await prisma.reversePickupRequest.findUnique({
    where: { id },
    select: {
      emailReceivedHour: true,
      city: true,
      state: true,
      odaLocation: true,
      slaStartDate: true,
      pickupDate: true,
      createdAt: true,
    },
  });

  if (!existing) return {};

  return resolveReversePickupSla({
    emailReceivedHour: overrides.emailReceivedHour ?? existing.emailReceivedHour,
    city: overrides.city !== undefined ? overrides.city : existing.city,
    state: overrides.state !== undefined ? overrides.state : existing.state,
    odaLocation:
      overrides.odaLocation !== undefined ? overrides.odaLocation : existing.odaLocation,
    pickupDate: overrides.pickupDate !== undefined ? overrides.pickupDate : existing.pickupDate,
    slaStartDate: existing.slaStartDate,
    fallbackStartDate: existing.createdAt,
  });
}

export async function getReversePickupRequests() {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canView");

  const requests = await prisma.reversePickupRequest.findMany({
    orderBy: { createdAt: "desc" },
  });

  return requests;
}

export async function getReversePickupRequest(id: string) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canView");

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

  const year = formData.get("year") as string;
  const currentYear = year ? parseIntValue(year) : new Date().getFullYear();

  const city = (formData.get("city") as string) || null;
  const state = (formData.get("state") as string) || null;
  const emailReceivedHour = (formData.get("emailReceivedHour") as string) || null;
  const odaLocation = normalizeOdaLocation(formData.get("odaLocation") as string);
  const pickupDate = parseDate(formData.get("pickupDate") as string);

  // Every SLA/TAT field is derived on the server so the stored values can never
  // disagree with the location and email hour they came from. The expected date
  // is deliberately not taken from the form: that field is read-only and echoes
  // the same derivation, so re-deriving here is both simpler and authoritative.
  // The raised date is the fallback SLA anchor, so a request with no usable email
  // hour still gets an expected date and a real Met/Missed verdict later.
  const sla = resolveReversePickupSla({
    emailReceivedHour,
    city,
    state,
    odaLocation,
    pickupDate,
    slaStartDate: parseDate(formData.get("slaStartDate") as string),
    fallbackStartDate: new Date(),
  });

  const data = {
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
    city,
    state,
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
    emailReceivedHour,
    cutOffStatus: sla.cutOffStatus,
    slaStartDate: sla.slaStartDate,
    slaState: (formData.get("slaState") as string) || null,
    zone1: sla.zone1,
    tier1: sla.tier1,
    odaLocation,
    tat: sla.tat,
    deliveryTat: sla.deliveryTat,
    expectedPickupDate: sla.expectedPickupDate,
    actualDeliveryPodDate: parseDate(formData.get("actualDeliveryPodDate") as string),
    sla: sla.sla,
    laptopAcceptanceDate: parseDate(formData.get("laptopAcceptanceDate") as string),

    // Courier / Tracking
    courierName: (formData.get("courierName") as string) || null,
    docketNumber: (formData.get("docketNumber") as string) || null,
    pickupDate,
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
  };

  // The number is read-then-write, so two engineers submitting at the same
  // moment can still land on the same value. Re-derive it and retry instead of
  // surfacing a raw unique-constraint error to the user.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.reversePickupRequest.create({
        data: { ...data, requestNumber: await nextReversePickupRequestNumber() },
      });
      break;
    } catch (error) {
      const requestNumberTaken =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 2;
      if (!requestNumberTaken) throw error;
    }
  }

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

  const existing = await prisma.reversePickupRequest.findUnique({
    where: { id },
    select: { docketNumber: true },
  });

  // The pickup date is what the SLA verdict is measured against, so the whole
  // derived chain is recomputed here rather than trusting whatever was stored
  // when the request was created.
  const sla = await recomputeSlaForRequest(id, { pickupDate });

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "PICKED_UP",
      pickupDate,
      docketNumber: docketNumber || existing?.docketNumber || null,
      ...sla,
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

// Overall QC result is derived from both stages: FAIL if either stage failed,
// PASS only when both passed, otherwise still pending.
function deriveQcResult(...stageResults: (string | null | undefined)[]) {
  const recorded = stageResults.filter((r): r is string => !!r).map((r) => r.toUpperCase());
  if (recorded.includes("FAIL")) return "FAIL";
  if (stageResults.length > 0 && recorded.length === stageResults.length && recorded.every((r) => r === "PASS")) {
    return "PASS";
  }
  return null;
}

export async function recordCleanQc(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const qcCleanResult = formData.get("qcCleanResult") as string;
  const qcCleanRemarks = formData.get("qcCleanRemarks") as string;
  const qcCleanDate = parseDate(formData.get("qcCleanDate") as string);
  const qcCleanBy = formData.get("qcCleanBy") as string;

  if (!id || !qcCleanResult) throw new Error("Request ID and Hardware QC result are required.");

  const existing = await prisma.reversePickupRequest.findUnique({
    where: { id },
    select: { qcPurgeResult: true },
  });

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "QC_CLEANED",
      qcCleanResult,
      qcCleanRemarks: qcCleanRemarks || null,
      qcCleanDate,
      qcCleanBy: qcCleanBy || null,
      qcResult: deriveQcResult(qcCleanResult, existing?.qcPurgeResult),
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function recordPurgeQc(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const qcPurgeResult = formData.get("qcPurgeResult") as string;
  const qcPurgeRemarks = formData.get("qcPurgeRemarks") as string;
  const qcPurgeDate = parseDate(formData.get("qcPurgeDate") as string);
  const qcPurgeBy = formData.get("qcPurgeBy") as string;

  if (!id || !qcPurgeResult) throw new Error("Request ID and Software QC result are required.");

  const existing = await prisma.reversePickupRequest.findUnique({
    where: { id },
    select: { qcCleanResult: true },
  });

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "QC_COMPLETED",
      qcPurgeResult,
      qcPurgeRemarks: qcPurgeRemarks || null,
      qcPurgeDate,
      qcPurgeBy: qcPurgeBy || null,
      qcResult: deriveQcResult(existing?.qcCleanResult, qcPurgeResult),
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

// Raised when a QC stage failed. The request parks here rather than advancing,
// because Blancco Clear refuses to run until both QC stages pass — without this
// state the asset just sat at QC with nothing recording why it could not move.
export async function logHpCase(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const hpCaseNumber = ((formData.get("hpCaseNumber") as string) || "").trim();
  const hpCaseRemarks = (formData.get("hpCaseRemarks") as string) || null;

  if (!id) throw new Error("Request ID is required.");
  if (!hpCaseNumber) throw new Error("HP case number is required.");

  const existing = await prisma.reversePickupRequest.findUnique({
    where: { id },
    select: { qcCleanResult: true, qcPurgeResult: true },
  });
  if (!existing) throw new Error("Request not found.");

  if (deriveQcResult(existing.qcCleanResult, existing.qcPurgeResult) !== "FAIL") {
    throw new Error("A case can only be logged with HP after a QC stage has failed.");
  }

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "CASE_LOGGED_WITH_HP",
      hpCaseNumber,
      hpCaseLoggedAt: new Date(),
      hpCaseLoggedBy: user.name || null,
      hpCaseRemarks,
      // Wiped in case an earlier case on this same row was already resolved.
      hpCaseResolvedAt: null,
      hpCaseResolvedBy: null,
      hpCaseResolvedRemarks: null,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
  revalidatePath("/dashboard/provisioning");
}

// Called from the provisioning HP Cases tab once the laptop is back from HP.
// Every field the failed QC run recorded is cleared so the request restarts
// cleanly at Hardware QC; deriveQcResult would otherwise keep reading FAIL and
// leave Blancco blocked.
export async function resolveHpCase(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  const canProvisioning = canModuleAction(user.permissions, user.role, "provisioning", "canEdit");
  const canReversePickup = canModuleAction(user.permissions, user.role, "reverse-pickup", "canEdit");
  if (!canProvisioning && !canReversePickup) throw new Error("Permission denied");

  const id = formData.get("id") as string;
  const hpCaseResolvedRemarks = (formData.get("hpCaseResolvedRemarks") as string) || null;

  if (!id) throw new Error("Request ID is required.");

  const existing = await prisma.reversePickupRequest.findUnique({
    where: { id },
    select: { status: true, hpCaseNumber: true },
  });
  if (!existing) throw new Error("Request not found.");
  if (existing.status !== "CASE_LOGGED_WITH_HP") {
    throw new Error("Only a request with an open HP case can be sent back to QC.");
  }

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "RECEIVED_AT_WAREHOUSE",
      qcResult: null,
      qcCleanResult: null,
      qcCleanRemarks: null,
      qcCleanDate: null,
      qcCleanBy: null,
      qcPurgeResult: null,
      qcPurgeRemarks: null,
      qcPurgeDate: null,
      qcPurgeBy: null,
      hpCaseResolvedAt: new Date(),
      hpCaseResolvedBy: user.name || null,
      hpCaseResolvedRemarks,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
  revalidatePath("/dashboard/provisioning");
}

export async function recordBlancoClear(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const result = formData.get("blancoClearResult") as string;
  const remarks = formData.get("blancoClearRemarks") as string;
  const clearDate = parseDate(formData.get("blancoClearDate") as string);
  const clearBy = formData.get("blancoClearBy") as string;

  if (!id || !result) throw new Error("Request ID and Blancco Clear result are required.");

  const existing = await prisma.reversePickupRequest.findUnique({
    where: { id },
    select: { qcCleanResult: true, qcPurgeResult: true },
  });

  if (deriveQcResult(existing?.qcCleanResult, existing?.qcPurgeResult) !== "PASS") {
    throw new Error("Blancco Clear is blocked until both Hardware QC and Software QC pass.");
  }

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "BLANCO_CLEARED",
      blancoClearResult: result,
      blancoClearRemarks: remarks || null,
      blancoClearDate: clearDate,
      blancoClearBy: clearBy || null,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function recordBlancoPurge(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const result = formData.get("blancoPurgeResult") as string;
  const remarks = formData.get("blancoPurgeRemarks") as string;
  const purgeDate = parseDate(formData.get("blancoPurgeDate") as string);
  const purgeBy = formData.get("blancoPurgeBy") as string;
  const blancoCertificateUrl = formData.get("blancoCertificateUrl") as string;
  const blancoCertificateDate = parseDate(formData.get("blancoCertificateDate") as string);

  if (!id || !result) throw new Error("Request ID and Blancco Purge result are required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: {
      status: "BLANCO_PURGED",
      blancoPurgeResult: result,
      blancoPurgeRemarks: remarks || null,
      blancoPurgeDate: purgeDate,
      blancoPurgeBy: purgeBy || null,
      blancoCertificateUrl: blancoCertificateUrl || null,
      blancoCertificateDate,
    },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function uploadPodDocument(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const podDocumentUrl = formData.get("podDocumentUrl") as string;

  if (!id || !podDocumentUrl) throw new Error("Request ID and POD document URL are required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: { podDocumentUrl },
  });

  revalidatePath("/dashboard/reverse-pickup");
}

export async function completeReversePickup(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Request ID is required.");

  const request = await prisma.reversePickupRequest.findUnique({
    where: { id },
    select: { serialNumber: true, inventoryItemId: true },
  });
  if (!request) throw new Error("Reverse pickup request not found.");

  const inventoryItem = request.inventoryItemId
    ? await prisma.inventoryItem.findUnique({ where: { id: request.inventoryItemId } })
    : await prisma.inventoryItem.findUnique({ where: { serialNumber: request.serialNumber } });

  await prisma.$transaction(async (tx) => {
    if (inventoryItem) {
      if (inventoryItem.employeeName) {
        const alreadyRecorded = await tx.assignmentRecord.findFirst({
          where: {
            inventoryItemId: inventoryItem.id,
            employeeName: inventoryItem.employeeName,
          },
        });
        if (!alreadyRecorded) {
          await tx.assignmentRecord.create({
            data: {
              inventoryItemId: inventoryItem.id,
              employeeName: inventoryItem.employeeName,
              emailId: inventoryItem.emailId,
              mobileNumber: inventoryItem.mobileNumber,
              alternatePhoneNumber: inventoryItem.alternatePhoneNumber,
              shippingAddress: inventoryItem.shippingAddress,
              landMark: inventoryItem.landMark,
              city: inventoryItem.city,
              state: inventoryItem.state,
              pinCode: inventoryItem.pinCode,
              purpose: inventoryItem.purpose,
              requestDate: inventoryItem.requestDate,
              userBaseLocation: inventoryItem.userBaseLocation,
              imageType: inventoryItem.imageType,
              count: inventoryItem.count,
              pwcRemarks: inventoryItem.pwcRemarks,
              trackingStatus: inventoryItem.trackingStatus,
              trackingSubStatus: inventoryItem.trackingSubStatus,
              dcNumber: inventoryItem.dcNumber,
              docketNumber: inventoryItem.docketNumber,
              deliveryDate: inventoryItem.deliveryDate,
              assignedAt: new Date(),
            },
          });
        }
      }

      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
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
    }

    await tx.reversePickupRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        finalDisposition: "RESTOCKED",
        inventoryItemId: inventoryItem?.id ?? request.inventoryItemId,
      },
    });
  });

  revalidatePath("/dashboard/reverse-pickup");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
}

// ─── Logistics / Finance handover actions ───

export async function assignReversePickupDocket(formData: FormData) {
  const user = await getSession();
  // This action is driven from the Logistics dashboard, so it is authorised
  // against the logistics module. A plain LOGISTICS user has no
  // reverse-pickup:canEdit grant and would otherwise be shown the docket queue
  // only to be rejected on submit.
  requirePermission(user, "logistics", "canEdit");

  const id = formData.get("id") as string;
  const docketNumber = formData.get("docketNumber") as string;
  if (!id || !docketNumber) throw new Error("Request ID and docket number are required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: { docketNumber, status: "DOCKET_ASSIGNED" },
  });

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/reverse-pickup");
}

export async function generateReversePickupEwayBill(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canEdit");

  const id = formData.get("id") as string;
  const eWayBillNo = formData.get("eWayBillNo") as string;
  const eWayBillDocumentUrl = (formData.get("eWayBillDocumentUrl") as string) || null;
  if (!id || !eWayBillNo) throw new Error("Request ID and e-way bill number are required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: { eWayBillNo, eWayBillDocumentUrl, status: "EWAY_BILL_GENERATED" },
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
  requirePermission(user, "reverse-pickup", "canView");

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
  requirePermission(user, "reverse-pickup", "canView");

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
