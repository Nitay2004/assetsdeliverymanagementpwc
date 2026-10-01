import { calculateCutoff } from "@/lib/cutoff-utils";
import {
  BASE_TAT_DAYS,
  calculateExpectedDeliveryDate,
  calculateTatDays,
  calculateTier,
  calculateZone,
  normalizeOdaLocation,
} from "@/lib/location-utils";
import { calculateSlaStatus } from "@/lib/sla-utils";

type DateInput = string | Date | null | undefined;

/**
 * Calendar day as "YYYY-MM-DD". Date instances are read through their local
 * getters so a date Prisma already read back out of a DATE column is not shifted
 * by the UTC offset.
 */
function toISODate(value: DateInput): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** UTC midnight, so Prisma writes exactly that calendar day into a DATE column. */
function fromISODate(iso: string | null): Date | null {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : null;
}

export type ReversePickupSlaInput = {
  emailReceivedHour?: string | null;
  city?: string | null;
  state?: string | null;
  odaLocation?: string | null;
  /** Actual date the device was collected — the other half of the SLA verdict. */
  pickupDate?: DateInput;
  /** Operator override; when absent the SLA start is derived from the email hour. */
  slaStartDate?: DateInput;
  /** Operator override; when absent it is derived from SLA start + TAT. */
  expectedPickupDate?: DateInput;
  /** Treat operator overrides as explicit values that should always win. */
  expectedPickupDateOverride?: boolean;
  /**
   * Stable day to anchor the TAT clock on when the email hour cannot produce an
   * SLA start date (blank, unparseable, or outside the two cutoff windows). Pass
   * the date the request was raised — never the current date — because the result
   * is stored, and re-anchoring on every later recompute would walk the expected
   * date forward and make every request look on time.
   */
  fallbackStartDate?: DateInput;
};

export type ReversePickupSla = {
  cutOffStatus: string | null;
  slaStartDate: Date | null;
  zone1: string | null;
  tier1: string | null;
  odaLocation: string;
  tat: string | null;
  deliveryTat: string | null;
  expectedPickupDate: Date | null;
  sla: string;
};

/**
 * Single source of truth for the reverse pickup SLA chain, mirroring the delivery
 * side: email hour → cutoff + SLA start, city/state → zone + tier, tier + ODA →
 * TAT, SLA start + TAT → expected pickup date, and pickup date vs expected →
 * Met/Missed. Called on create, on import and whenever the pickup date is set,
 * so the stored SLA can never drift away from the tier it was derived from.
 *
 * A stored `expectedPickupDate` is only honoured when it was explicitly flagged
 * as an operator override. Without that flag it is treated as the previous run's
 * derived output, so a later change of city/state/ODA cannot leave the expected
 * date stale.
 *
 * The verdict never gets stuck: an expected date is always produced, because the
 * SLA start falls back to the date the request was raised and the TAT falls back
 * to the base TAT when no tier can be derived. So the only way to land on
 * "To Be Updated" is a genuinely blank pickup date.
 */
export function resolveReversePickupSla(input: ReversePickupSlaInput): ReversePickupSla {
  const city = input.city ?? null;
  const state = input.state ?? null;
  const odaLocation = normalizeOdaLocation(input.odaLocation ?? null);

  const cutoff = input.emailReceivedHour ? calculateCutoff(input.emailReceivedHour) : null;
  const tier = calculateTier(city, state);
  const tatDays = calculateTatDays(city, state, odaLocation) ?? BASE_TAT_DAYS;
  const tatValue = String(tatDays);

  const slaStartDate =
    toISODate(input.slaStartDate) ??
    toISODate(cutoff?.slaStartDate ?? null) ??
    toISODate(input.fallbackStartDate ?? null);

  const override = input.expectedPickupDateOverride ? toISODate(input.expectedPickupDate) : null;
  const expectedPickupDate = override ?? calculateExpectedDeliveryDate(slaStartDate, tatDays);

  return {
    cutOffStatus: cutoff?.cutOffStatus ?? null,
    slaStartDate: fromISODate(slaStartDate),
    zone1: calculateZone(city, state),
    tier1: tier,
    odaLocation,
    tat: tatValue,
    deliveryTat: tatValue,
    expectedPickupDate: fromISODate(expectedPickupDate),
    sla: calculateSlaStatus(input.pickupDate ?? null, expectedPickupDate),
  };
}