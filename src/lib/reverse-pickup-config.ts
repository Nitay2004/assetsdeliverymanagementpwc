export const TYPE_OPTIONS = [
  { value: "Internal", label: "Internal" },
  { value: "External", label: "External" },
  { value: "Warranty", label: "Warranty" },
  { value: "Insurance", label: "Insurance" },
  { value: "Office", label: "Office" },
];

export const ENTITY_OPTIONS = [
  { value: "PWC", label: "PWC" },
  { value: "Client", label: "Client" },
  { value: "Vendor", label: "Vendor" },
];

export const IMAGE_TYPE_OPTIONS = [
  { value: "Windows", label: "Windows" },
  { value: "Mac", label: "Mac" },
  { value: "Linux", label: "Linux" },
  { value: "Custom", label: "Custom" },
];

export const REASON_OPTIONS = [
  { value: "Upgrade", label: "Upgrade" },
  { value: "Defective", label: "Defective" },
  { value: "Return to Stock", label: "Return to Stock" },
  { value: "Employee Exit", label: "Employee Exit" },
  { value: "Replacement", label: "Replacement" },
];

export const DISPLAY_STATUS_OPTIONS = [
  { value: "Received", label: "Received" },
  { value: "Pickup Pending", label: "Pickup Pending" },
  { value: "Pickup Initiated", label: "Pickup Initiated" },
];

export const DEPENDENCY_OPTIONS = [
  { value: "None", label: "None" },
  { value: "Data Backup", label: "Data Backup" },
  { value: "Accessories", label: "Accessories" },
  { value: "Approval", label: "Approval" },
  { value: "Finance Clearance", label: "Finance Clearance" },
];

export const COURIER_OPTIONS = [
  { value: "Blanco", label: "Blanco" },
  { value: "Delhivery", label: "Delhivery" },
  { value: "Blue Dart", label: "Blue Dart" },
  { value: "DTDC", label: "DTDC" },
  { value: "FedEx", label: "FedEx" },
  { value: "Other", label: "Other" },
];

export const BLANCO_YES_NO_OPTIONS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

export const WAREHOUSE_OPTIONS = [
  { value: "Kolkata", label: "Kolkata" },
  { value: "Bangalore", label: "Bangalore" },
  { value: "Gurgaon", label: "Gurgaon" },
];

export const PARTNER_OPTIONS = COURIER_OPTIONS;

export const DISPOSITION_OPTIONS = [
  { value: "RESTOCKED", label: "Restocked" },
  { value: "DEFECTIVE", label: "Defective" },
  { value: "RETIRED", label: "Retired" },
];

export const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  PARTNER_ASSIGNED: "Partner Assigned",
  DOCKET_REQUESTED: "Docket Requested",
  DOCKET_ASSIGNED: "Docket Assigned",
  INSPECTED: "Inspected",
  PICKED_UP: "Picked Up",
  PICKUP_CANCELLED: "Pickup Cancelled",
  DUPLICATE: "Duplicate",
  ALREADY_SUBMITTED_TO_PWC_OFFICE: "Already Submitted to PWC Office",
  PENDING: "Pending",
  PWC_CONFIRMATION_AWAITED: "PwC Confirmation Awaited",
  GATEPASS_PENDING: "Gatepass Pending",
  ALIGN_FOR_PICKUP: "Align for Pickup",
  IN_TRANSIT: "In Transit",
  ON_HOLD: "On Hold",
  RTO_CASE: "RTO Case",
  LOST_DEVICE: "Lost Device",
  RECEIVED_AT_WAREHOUSE: "At Warehouse",
  QC_CLEANED: "Hardware QC",
  QC_COMPLETED: "Software QC",
  CASE_LOGGED_WITH_HP: "Case Logged with HP",
  DC_REQUESTED: "DC Requested",
  DC_GENERATED: "DC Generated",
  EWAY_BILL_REQUESTED: "E-Way Bill Requested",
  EWAY_BILL_GENERATED: "E-Way Bill Generated",
  BLANCO_CLEARED: "Blanco Clear",
  BLANCO_PURGED: "Blanco Purge",
  BLANCO_CERTIFIED: "Blanco Certified",
  COMPLETED: "Completed",
};

export const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  REQUESTED:              { next: "PARTNER_ASSIGNED",      label: "Assign Partner" },
  // Every step from partner alignment through docket assignment is driven by the
  // Logistics team from their reverse pipeline, so the detail page shows an
  // informational card for these states instead of an action.
  PARTNER_ASSIGNED:       null,  // Logistics requests DC
  DC_REQUESTED:           null,  // Finance generates DC
  DC_GENERATED:           null,  // Logistics requests e-way bill
  EWAY_BILL_REQUESTED:    null,  // Finance generates e-way bill
  EWAY_BILL_GENERATED:    null,  // Logistics assigns docket
  DOCKET_REQUESTED:       null,  // Logistics assigns docket and advances to DOCKET_ASSIGNED
  DOCKET_ASSIGNED:        { next: "INSPECTED",             label: "Record Inspection" },
  INSPECTED:              { next: "PICKED_UP",             label: "Mark Picked Up" },
  PICKED_UP:              null,  // Warehouse receives the unit
  RECEIVED_AT_WAREHOUSE:  { next: "QC_CLEANED",             label: "Record Hardware QC" },
  QC_CLEANED:             { next: "QC_COMPLETED",          label: "Record Software QC" },
  QC_COMPLETED:           { next: "BLANCO_CLEARED",         label: "Record Blanco Clear" },
  // Set by logHpCase once a QC stage has failed. It has no next step: the
  // request only leaves here when provisioning marks the HP case resolved,
  // which puts it back at RECEIVED_AT_WAREHOUSE for a fresh QC run.
  CASE_LOGGED_WITH_HP:    null,
  BLANCO_CLEARED:         { next: "BLANCO_PURGED",          label: "Record Blanco Purge" },
  BLANCO_PURGED:          { next: "COMPLETED",              label: "Move to Inventory" },
  // Legacy terminal state kept so requests certified before the Blancco Clear /
  // Purge split was introduced can still be closed out.
  BLANCO_CERTIFIED:       { next: "COMPLETED",              label: "Move to Inventory" },
  COMPLETED:              null,
};

export function getNextStatus(currentStatus: string): { next: string; label: string } | null {
  return STATUS_FLOW[currentStatus] ?? null;
}

// Warehouse documents (POD) only make sense once the courier has actually
// handed the asset over, so the upload stays hidden until then. Everything from
// RECEIVED_AT_WAREHOUSE onwards qualifies, including the QC and Blancco stages.
const WAREHOUSE_REACHED_STATUSES = new Set([
  "RECEIVED_AT_WAREHOUSE",
  "QC_CLEANED",
  "QC_COMPLETED",
  "CASE_LOGGED_WITH_HP",
  "BLANCO_CLEARED",
  "BLANCO_PURGED",
  "BLANCO_CERTIFIED",
  "COMPLETED",
]);

export function hasReachedWarehouse(status: string): boolean {
  return WAREHOUSE_REACHED_STATUSES.has(status);
}

/** Statuses where a unit is inbound and still has to be received at a warehouse. */
export const WAREHOUSE_RECEIVABLE_STATUSES: string[] = ["PICKED_UP", "IN_TRANSIT"];

/** Every status from the moment a unit has reached a warehouse onward. */
export const WAREHOUSE_RECEIVED_STATUSES: string[] = [...WAREHOUSE_REACHED_STATUSES];

/** The whole warehouse-side reverse pipeline: inbound units plus received ones. */
export const WAREHOUSE_PIPELINE_STATUSES: string[] = [
  ...WAREHOUSE_RECEIVABLE_STATUSES,
  ...WAREHOUSE_RECEIVED_STATUSES,
];

/** Statuses where actions are owned by the Warehouse Reverse tab (post-receipt). */
export const WAREHOUSE_OWNED_STATUSES: string[] = [
  "RECEIVED_AT_WAREHOUSE",
  "QC_CLEANED",
  "QC_COMPLETED",
  "BLANCO_CLEARED",
  "BLANCO_PURGED",
  "BLANCO_CERTIFIED",
];

// All seedable categories for the DropdownOption table
export const SEED_CATEGORIES: Record<string, { value: string; label: string }[]> = {
  type: TYPE_OPTIONS,
  entity: ENTITY_OPTIONS,
  imageType: IMAGE_TYPE_OPTIONS,
  reason: REASON_OPTIONS,
  warehouseLocation: WAREHOUSE_OPTIONS,
  displayStatus: DISPLAY_STATUS_OPTIONS,
  dependency: DEPENDENCY_OPTIONS,
  courierName: COURIER_OPTIONS,
  blanccoYesNo: BLANCO_YES_NO_OPTIONS,
  partnerName: PARTNER_OPTIONS,
  disposition: DISPOSITION_OPTIONS,
};
