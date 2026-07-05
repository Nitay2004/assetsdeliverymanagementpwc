export const TYPE_OPTIONS = [
  { value: "Internal", label: "Internal" },
  { value: "External", label: "External" },
  { value: "Warranty", label: "Warranty" },
  { value: "Insurance", label: "Insurance" },
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
  INSPECTED: "Inspected",
  PICKED_UP: "Picked Up",
  RECEIVED_AT_WAREHOUSE: "At Warehouse",
  QC_COMPLETED: "QC Completed",
  DC_REQUESTED: "DC Requested",
  DC_GENERATED: "DC Generated",
  EWAY_BILL_REQUESTED: "E-Way Bill Requested",
  EWAY_BILL_GENERATED: "E-Way Bill Generated",
  BLANCO_CERTIFIED: "Blanco Certified",
  COMPLETED: "Completed",
};

export const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  REQUESTED:              { next: "PARTNER_ASSIGNED",      label: "Assign Partner" },
  PARTNER_ASSIGNED:       { next: "DOCKET_REQUESTED",      label: "Request Docket" },
  DOCKET_REQUESTED:       null,  // Logistics assigns docket and advances to INSPECTED
  INSPECTED:              { next: "PICKED_UP",             label: "Mark Picked Up" },
  PICKED_UP:              { next: "RECEIVED_AT_WAREHOUSE", label: "Receive at Warehouse" },
  RECEIVED_AT_WAREHOUSE:  { next: "QC_COMPLETED",          label: "Record QC" },
  QC_COMPLETED:           { next: "DC_REQUESTED",          label: "Request DC" },
  DC_REQUESTED:           null,  // Finance generates DC
  DC_GENERATED:           { next: "EWAY_BILL_REQUESTED",   label: "Request E-Way Bill" },
  EWAY_BILL_REQUESTED:    null,  // Finance generates e-way bill
  EWAY_BILL_GENERATED:    { next: "BLANCO_CERTIFIED",      label: "Upload Blanco Certificate" },
  BLANCO_CERTIFIED:       { next: "COMPLETED",             label: "Complete" },
  COMPLETED:              null,
};

export function getNextStatus(currentStatus: string): { next: string; label: string } | null {
  return STATUS_FLOW[currentStatus] ?? null;
}

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
