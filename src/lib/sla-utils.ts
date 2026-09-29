export const SLA_STATUS_MET = "Met";
export const SLA_STATUS_MISSED = "Missed";
export const SLA_STATUS_PENDING = "To Be Updated";

/** Coerces "YYYY-MM-DD", a full ISO timestamp or a Date to a local-midnight Date. */
function toLocalDate(value?: string | Date | null): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * SLA Missed/Met is derived, never typed in by hand:
 *  - no actual delivery date yet       -> "To Be Updated"
 *  - actual delivery <= expected date   -> "Met"
 *  - actual delivery after expected     -> "Missed"
 */
export function calculateSlaStatus(
  actualDeliveryDate?: string | Date | null,
  expectedDeliveryDate?: string | Date | null
): string {
  const actual = toLocalDate(actualDeliveryDate);
  if (!actual) return SLA_STATUS_PENDING;
  const expected = toLocalDate(expectedDeliveryDate);
  if (!expected) return SLA_STATUS_PENDING;
  return actual.getTime() <= expected.getTime() ? SLA_STATUS_MET : SLA_STATUS_MISSED;
}