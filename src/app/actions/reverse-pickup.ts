"use server";

import { Prisma, type InventoryItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission, canModuleAction } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeOdaLocation } from "@/lib/location-utils";
import { resolveReversePickupSla } from "@/lib/reverse-pickup-sla";
import { nextSequenceNumber } from "@/lib/sequence-number";
import { hasPriorDelivery } from "@/app/actions/assignment";

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

// Handover steps are driven from the owning module's dashboard: Logistics owns
// the partner / DC / e-way / docket handovers and Warehouse owns the
// receive-at-warehouse step. A plain user of either module has no
// reverse-pickup:canEdit grant, so these actions also accept the owning module's
// edit permission rather than showing a control that would be rejected on submit.
function requireModuleEditOrReversePickup(
  user: { permissions: unknown; role: string } | null,
  module: "logistics" | "warehouse",
): void {
  if (!user) throw new Error("Unauthorized");
  const canOwn = canModuleAction(user.permissions, user.role, module, "canEdit");
  const canReversePickup = canModuleAction(user.permissions, user.role, "reverse-pickup", "canEdit");
  if (!canOwn && !canReversePickup) throw new Error("Permission denied");
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
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  return requests;
}

export async function getReversePickupRequest(id: string) {
  const user = await getSession();
  requirePermission(user, "reverse-pickup", "canView");

  return prisma.reversePickupRequest.findUnique({ where: { id } });
}

// ─── Reverse pickup eligibility ───
//
// A reverse pickup may only be raised for an asset that is actually out with a
// user (ALLOCATED) and has delivery evidence, and only while no other request
// for the same serial is still open. This is the single source of truth for
// those rules: the create action and the form's live inline check both go
// through it, so the reason shown to the operator is exactly the reason the
// server would reject the request.

const TERMINAL_REVERSE_PICKUP_STATUSES = ["COMPLETED", "PICKUP_CANCELLED", "DUPLICATE"] as const;

// Returns serial -> reason for every serial that may NOT be picked up. Serials
// that are fine are simply absent from the map.
async function getReversePickupBlockReasons(serials: string[]): Promise<Map<string, string>> {
  const blocked = new Map<string, string>();
  const unique = [...new Set(serials.map((s) => s.trim()).filter(Boolean))];
  if (unique.length === 0) return blocked;

  const [activeRpRows, inventoryRows] = await Promise.all([
    prisma.reversePickupRequest.findMany({
      where: {
        serialNumber: { in: unique },
        status: { notIn: [...TERMINAL_REVERSE_PICKUP_STATUSES] },
      },
      select: { serialNumber: true, requestNumber: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inventoryItem.findMany({
      where: { serialNumber: { in: unique } },
      select: { id: true, serialNumber: true, status: true },
    }),
  ]);

  const inventoryBySerial = new Map(inventoryRows.map((i) => [i.serialNumber, i]));
  // Newest first, so the first row seen per serial is the current open request.
  const activeRpBySerial = new Map<string, { requestNumber: string; status: string }>();
  for (const row of activeRpRows) {
    if (!activeRpBySerial.has(row.serialNumber)) activeRpBySerial.set(row.serialNumber, row);
  }

  for (const serial of unique) {
    // Duplicate guard: while any request for this serial is still open, no
    // second one may be raised. The serial can only be requested again after
    // the open request reaches a terminal state (came back / cancelled).
    const activeRp = activeRpBySerial.get(serial);
    if (activeRp) {
      blocked.set(
        serial,
        `A reverse pickup request is already open for this serial (${activeRp.requestNumber}, status: ${activeRp.status}). Complete or cancel it before raising another one.`
      );
      continue;
    }

    const inventoryItem = inventoryBySerial.get(serial);
    if (!inventoryItem) {
      blocked.set(
        serial,
        "Serial number not found in inventory. Reverse pickup can only be raised for an asset that is deployed and delivered to a user."
      );
      continue;
    }

    // Only an asset that is out with a user (ALLOCATED) may be picked up.
    // Anything still in inventory — NEW/AVAILABLE/QC_PENDING/DEFECTIVE/RETIRED —
    // is in our hands or in provisioning, so there is nothing to collect.
    if (inventoryItem.status !== "ALLOCATED") {
      blocked.set(
        serial,
        `Asset is in inventory (status: ${inventoryItem.status.toLowerCase().replace(/_/g, " ")}), not deployed to a user. Reverse pickup can only be raised for an asset that is deployed and delivered.`
      );
      continue;
    }

    // Allocated alone is not enough: an asset can be allocated to an order that
    // has not shipped yet (or parked in provisioning). Require delivery evidence.
    const delivered = await hasPriorDelivery(inventoryItem.id, serial);
    if (!delivered) {
      blocked.set(
        serial,
        "Asset is allocated but has no record of being delivered to a user. Reverse pickup can only be raised for an asset that has been delivered."
      );
    }
  }

  return blocked;
}

// Live check used by the form: as soon as a serial is typed, the form asks
// whether a request could actually be created for it and shows the reason when
// it could not. Takes the serials currently on the form so the office table can
// be checked in a single round trip.
export async function checkReversePickupEligibility(
  serials: string[]
): Promise<Record<string, { ok: boolean; message: string }>> {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  requirePermission(user, "reverse-pickup", "canView");

  const unique = [...new Set((serials ?? []).map((s) => (s ?? "").trim()).filter(Boolean))];
  if (unique.length === 0) return {};

  const blocked = await getReversePickupBlockReasons(unique);
  return Object.fromEntries(
    unique.map((serial) => [serial, { ok: !blocked.has(serial), message: blocked.get(serial) ?? "" }])
  );
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

  const serial = data.serialNumber?.trim();
  if (!serial) {
    throw new Error("Serial number is required");
  }

  // The office flow submits several serials in one field, joined by ", " — every
  // serial must pass the same guards before the single request row is created.
  const serialsToValidate = serial.split(",").map((s) => s.trim()).filter(Boolean);

  const blocked = await getReversePickupBlockReasons(serialsToValidate);
  const firstBlocked = serialsToValidate.find((s) => blocked.has(s));
  if (firstBlocked) {
    const reason = blocked.get(firstBlocked) ?? "Reverse pickup cannot be raised for this serial.";
    // Name the serial when several share one field (office flow); for a single
    // serial the field the user typed into already makes it obvious.
    throw new Error(serialsToValidate.length > 1 ? `Serial ${firstBlocked}: ${reason}` : reason);
  }

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
  requireModuleEditOrReversePickup(user, "logistics");

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

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/reverse-pickup");
}

// All three handover steps are driven from the Logistics pipeline, so each one
// refreshes both the logistics queue (where the row moves on) and the reverse
// detail page (where the matching "Awaiting ..." card is shown).
export async function requestDc(formData: FormData) {
  const user = await getSession();
  requireModuleEditOrReversePickup(user, "logistics");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Request ID is required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: { status: "DC_REQUESTED" },
  });

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/reverse-pickup");
}

export async function requestEwayBill(formData: FormData) {
  const user = await getSession();
  requireModuleEditOrReversePickup(user, "logistics");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Request ID is required.");

  await prisma.reversePickupRequest.update({
    where: { id },
    data: { status: "EWAY_BILL_REQUESTED" },
  });

  revalidatePath("/dashboard/logistics");
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

// Archives the item's current user into assignment history (so it shows up
// under "previous") and returns the unit to stock. Shared by the inward and
// complete steps; the alreadyRecorded check keeps it safe to run twice.
async function restockInventoryItem(tx: Prisma.TransactionClient, inventoryItem: InventoryItem) {
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

export async function receiveAtWarehouse(formData: FormData) {
  const user = await getSession();
  // Receiving the unit is the Warehouse team's job, driven from their Reverse tab.
  requireModuleEditOrReversePickup(user, "warehouse");

  const id = formData.get("id") as string;
  const warehouseLocation = formData.get("warehouseLocation") as string;
  const receivedDate = parseDate(formData.get("receivedDate") as string);
  const receivedBy = formData.get("receivedBy") as string;

  if (!id || !warehouseLocation) throw new Error("Request ID and warehouse location are required.");

  const request = await prisma.reversePickupRequest.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!request) throw new Error("Reverse pickup request not found.");

  // Server-side precondition: receiving is only valid straight after pick-up.
  // The UI gates the button, but a stale/double form submit must not re-run the
  // restock side effect once the unit has moved on (e.g. re-assigned).
  const RECEIVABLE_STATUSES = ["PICKED_UP", "IN_TRANSIT"] as const;
  if (!RECEIVABLE_STATUSES.includes(request.status as (typeof RECEIVABLE_STATUSES)[number])) {
    throw new Error(
      `Cannot receive: request is "${request.status}" (expected ${RECEIVABLE_STATUSES.join(" or ")}).`
    );
  }

  await prisma.$transaction(async (tx) => {
    // Re-read both rows inside the transaction so the restock decision and the
    // status flip act on current data, not a possibly stale pre-transaction read.
    const current = await tx.reversePickupRequest.findUnique({
      where: { id },
      select: { inventoryItemId: true, serialNumber: true },
    });
    if (!current) throw new Error("Reverse pickup request not found.");

    const item = current.inventoryItemId
      ? await tx.inventoryItem.findUnique({ where: { id: current.inventoryItemId } })
      : await tx.inventoryItem.findUnique({ where: { serialNumber: current.serialNumber } });

    // Inward = unit is back in our hands: the current user moves to assignment
    // history and the serial becomes AVAILABLE stock again.
    if (item) {
      await restockInventoryItem(tx, item);
    }

    // Optimistic status guard: exactly one row may leave RECEIVABLE state.
    const { count } = await tx.reversePickupRequest.updateMany({
      where: { id, status: { in: [...RECEIVABLE_STATUSES] } },
      data: {
        status: "RECEIVED_AT_WAREHOUSE",
        warehouseLocation,
        receivedDate,
        receivedBy: receivedBy || null,
        inventoryItemId: item?.id ?? current.inventoryItemId,
      },
    });
    if (count !== 1) {
      throw new Error("Request already received or status changed — refresh and retry.");
    }
  });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/reverse-pickup");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
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
  // Hardware QC is recorded by the Warehouse team from their Reverse tab, so the
  // owning module's edit grant is accepted alongside reverse-pickup:canEdit.
  requireModuleEditOrReversePickup(user, "warehouse");

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

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/reverse-pickup");
  revalidatePath("/dashboard/provisioning");
}

export async function recordPurgeQc(formData: FormData) {
  const user = await getSession();
  // Software QC is recorded by the Warehouse team from their Reverse tab.
  requireModuleEditOrReversePickup(user, "warehouse");

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

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/reverse-pickup");
  revalidatePath("/dashboard/provisioning");
}

// Raised when a QC stage failed. The request parks here rather than advancing,
// because Blancco Clear refuses to run until both QC stages pass — without this
// state the asset just sat at QC with nothing recording why it could not move.
export async function logHpCase(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  // Logged by the Warehouse team when a QC stage fails on their Reverse tab.
  requireModuleEditOrReversePickup(user, "warehouse");

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

  revalidatePath("/dashboard/warehouse");
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
  // Blancco Clear is recorded by the Warehouse team from their Reverse tab.
  requireModuleEditOrReversePickup(user, "warehouse");

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

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/reverse-pickup");
}

export async function recordBlancoPurge(formData: FormData) {
  const user = await getSession();
  // Blancco Purge + certificate are recorded by the Warehouse team from their
  // Reverse tab.
  requireModuleEditOrReversePickup(user, "warehouse");

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

  revalidatePath("/dashboard/warehouse");
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
  // The final move back to inventory is driven from the Warehouse Reverse tab.
  requireModuleEditOrReversePickup(user, "warehouse");

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
      await restockInventoryItem(tx, inventoryItem);
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

  revalidatePath("/dashboard/warehouse");
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
