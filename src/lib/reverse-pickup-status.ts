import { STATUS_LABELS } from "@/lib/reverse-pickup-config";

// Shared status resolution for reverse-pickup imports. The workflow enum in the
// DB (legal statuses like REQUESTED, DOCKET_ASSIGNED, ...) and the free-text
// "Display Status" column of the PWC tracking sheets are two different worlds:
// an upload must translate the sheet's display values into the closest enum so
// list badges, filters and the detail-page stage tracker all agree. The detail
// view re-uses the same resolver so requests imported with a generic status
// still open on the stage that matches the request's real progress.

const statusToEnum: Record<string, string> = {
  REQUESTED: "REQUESTED",
  PARTNER_ASSIGNED: "PARTNER_ASSIGNED",
  DOCKET_REQUESTED: "DOCKET_REQUESTED",
  DOCKET_ASSIGNED: "DOCKET_ASSIGNED",
  INSPECTED: "INSPECTED",
  PICKED_UP: "PICKED_UP",
  PICKUP_CANCELLED: "PICKUP_CANCELLED",
  DUPLICATE: "DUPLICATE",
  ALREADY_SUBMITTED_TO_PWC_OFFICE: "ALREADY_SUBMITTED_TO_PWC_OFFICE",
  PENDING: "PENDING",
  PWC_CONFIRMATION_AWAITED: "PWC_CONFIRMATION_AWAITED",
  GATEPASS_PENDING: "GATEPASS_PENDING",
  ALIGN_FOR_PICKUP: "ALIGN_FOR_PICKUP",
  IN_TRANSIT: "IN_TRANSIT",
  ON_HOLD: "ON_HOLD",
  RTO_CASE: "RTO_CASE",
  LOST_DEVICE: "LOST_DEVICE",
  RECEIVED_AT_WAREHOUSE: "RECEIVED_AT_WAREHOUSE",
  QC_CLEANED: "QC_CLEANED",
  QC_COMPLETED: "QC_COMPLETED",
  CASE_LOGGED_WITH_HP: "CASE_LOGGED_WITH_HP",
  DC_REQUESTED: "DC_REQUESTED",
  DC_GENERATED: "DC_GENERATED",
  EWAY_BILL_REQUESTED: "EWAY_BILL_REQUESTED",
  EWAY_BILL_GENERATED: "EWAY_BILL_GENERATED",
  BLANCO_CLEARED: "BLANCO_CLEARED",
  BLANCO_PURGED: "BLANCO_PURGED",
  BLANCO_CERTIFIED: "BLANCO_CERTIFIED",
  COMPLETED: "COMPLETED",
};

export const labelToStatus: Record<string, string> = {};
for (const [enumValue, label] of Object.entries(STATUS_LABELS)) {
  labelToStatus[label.toLowerCase()] = statusToEnum[enumValue] ?? enumValue;
  labelToStatus[enumValue.replace(/_/g, " ").toLowerCase()] = statusToEnum[enumValue] ?? enumValue;
}

// The shared PWC tracking sheet marks pickup progress with these display values,
// not with workflow-status labels. Map them to the closest enum state so an
// upload doesn't silently reset everything back to REQUESTED.
// "Display Status" column common-practice values observed in real files.
labelToStatus["received"] = "RECEIVED_AT_WAREHOUSE";
labelToStatus["pickup pending"] = "REQUESTED";
labelToStatus["pickup initiated"] = "PARTNER_ASSIGNED";
labelToStatus["asset received in warehouse"] = "RECEIVED_AT_WAREHOUSE";
labelToStatus["asset received in warehouse "] = "RECEIVED_AT_WAREHOUSE";
labelToStatus["pickup cancelled"] = "PICKUP_CANCELLED";
labelToStatus["cancel"] = "PICKUP_CANCELLED";
labelToStatus["cancelled"] = "PICKUP_CANCELLED";
labelToStatus["duplicate"] = "DUPLICATE";
labelToStatus["already submitted to pwc office"] = "ALREADY_SUBMITTED_TO_PWC_OFFICE";
labelToStatus["submitted to pwc office"] = "ALREADY_SUBMITTED_TO_PWC_OFFICE";
labelToStatus["pending for gatepass"] = "GATEPASS_PENDING";
labelToStatus["gatepass pending"] = "GATEPASS_PENDING";
labelToStatus["pwc confirmation awaited"] = "PWC_CONFIRMATION_AWAITED";
labelToStatus["pw c confirmation awaited"] = "PWC_CONFIRMATION_AWAITED";
labelToStatus["align for pickup"] = "ALIGN_FOR_PICKUP";
labelToStatus["pickup complete (in transit to warehouse)"] = "IN_TRANSIT";
labelToStatus["in transit"] = "IN_TRANSIT";
labelToStatus["pickup complete"] = "IN_TRANSIT";
labelToStatus["on hold"] = "ON_HOLD";
labelToStatus["hold"] = "ON_HOLD";
labelToStatus["lost device"] = "LOST_DEVICE";
labelToStatus["rto case"] = "RTO_CASE";
labelToStatus["inspection done"] = "INSPECTED";
labelToStatus["inspected"] = "INSPECTED";
labelToStatus["pending"] = "PENDING";
labelToStatus["qe"] = "QC_CLEANED";
labelToStatus["hardware qc"] = "QC_CLEANED";
labelToStatus["software qc"] = "QC_COMPLETED";
labelToStatus["qc done"] = "QC_COMPLETED";
labelToStatus["qc completed"] = "QC_COMPLETED";
labelToStatus["case logged with hp"] = "CASE_LOGGED_WITH_HP";
labelToStatus["blanco cleared"] = "BLANCO_CLEARED";
labelToStatus["blanco purged"] = "BLANCO_PURGED";
labelToStatus["blanco certified"] = "BLANCO_CERTIFIED";
labelToStatus["completed"] = "COMPLETED";
labelToStatus["close"] = "COMPLETED";
labelToStatus["closed"] = "COMPLETED";
labelToStatus["done"] = "COMPLETED";
labelToStatus["dock requested"] = "DC_REQUESTED";
labelToStatus["dc requested"] = "DC_REQUESTED";
labelToStatus["dc generated"] = "DC_GENERATED";
labelToStatus["dc ready"] = "DC_GENERATED";
labelToStatus["eway bill requested"] = "EWAY_BILL_REQUESTED";
labelToStatus["e-way bill requested"] = "EWAY_BILL_REQUESTED";
labelToStatus["eway bill generated"] = "EWAY_BILL_GENERATED";
labelToStatus["e-way bill generated"] = "EWAY_BILL_GENERATED";
labelToStatus["docket requested"] = "DOCKET_REQUESTED";
labelToStatus["docket assigned"] = "DOCKET_ASSIGNED";
labelToStatus["assign partner"] = "PARTNER_ASSIGNED";
labelToStatus["partner assigned"] = "PARTNER_ASSIGNED";

export function resolveStatus(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (statusToEnum[normalized]) return statusToEnum[normalized];
  const byLabel = labelToStatus[raw.trim().toLowerCase()];
  if (byLabel) return byLabel;
  return null;
}