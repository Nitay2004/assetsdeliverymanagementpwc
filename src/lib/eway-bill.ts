// E-Way Bill rules for GST compliance.
//
// An e-way bill is mandatory for the movement of goods whose consignment value
// exceeds ₹50,000. The 12-digit number is issued by the GST e-way bill portal
// and must be unique across the system.

/** Consignment value above which an e-way bill is required (₹50,000). */
export const EWAY_BILL_MIN_VALUE = 50000;

const EWAY_BILL_PATTERN = /^\d{12}$/;

/**
 * Validates the shape of an e-way bill number.
 * Returns null when valid, or an error message string.
 */
export function validateEwayBillNumber(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "E-Way Bill number is required.";
  if (!EWAY_BILL_PATTERN.test(trimmed)) return "E-Way Bill number must be exactly 12 digits.";
  return null;
}

/** Whether the consignment value is above the statutory e-way threshold. */
export function requiresEwayBill(consignmentValue: number | null | undefined): boolean {
  return (consignmentValue ?? 0) > EWAY_BILL_MIN_VALUE;
}
