/**
 * Delivery location classification used by the assign-user flow.
 *
 * The same city/state pair drives both Zone and Tier.
 *
 * Zone (Karnataka-only view):
 *  - Bengaluru (any spelling) → "Within City"
 *  - Any other city in Karnataka → "Within State"
 *  - Anywhere else → "Inter State"
 *
 * Tier:
 *  - Bengaluru → Tier 1
 *  - Any other city in Karnataka → Tier 2
 *  - Hyderabad / Chennai / Mumbai / Delhi → Tier 3
 *  - Every other city → Tier 4
 *
 * City and state both empty → null (Zone and Tier stay empty).
 */
export const ZONE_WITHIN_CITY = "Within City";
export const ZONE_WITHIN_STATE = "Within State";
export const ZONE_INTER_STATE = "Inter State";

export const TIER_CITY = "Tier 1";
export const TIER_STATE = "Tier 2";
export const TIER_METRO = "Tier 3";
export const TIER_REST = "Tier 4";

/** Base TAT in days, before the ODA uplift. */
export const BASE_TAT_DAYS = 4;

/** Extra days added to the base TAT when an ODA location is present. */
export const ODA_TAT_UPLIFT_DAYS = 2;

const HOME_CITY_KEYWORDS = ["bengaluru", "bangalore"];
const HOME_STATE_KEYWORDS = ["karnataka"];
const METRO_CITY_KEYWORDS = ["hyderabad", "chennai", "mumbai", "delhi"];

const POSITIVE_ODA_KEYWORDS = ["yes", "y", "true", "1", "oda"];

const TAT_DAYS_BY_TIER: Record<string, number> = {
  [TIER_CITY]: 3,
  [TIER_STATE]: 4,
  [TIER_METRO]: 5,
  [TIER_REST]: 8,
};

export type LocationScope = "city" | "state" | "metro" | "rest" | null;

export function classifyLocation(
  city?: string | null,
  state?: string | null
): LocationScope {
  const normalizedCity = normalize(city);
  const normalizedState = normalize(state);

  if (!normalizedCity && !normalizedState) return null;

  if (matchesAny(normalizedCity, HOME_CITY_KEYWORDS)) return "city";
  if (matchesAny(normalizedState, HOME_STATE_KEYWORDS)) return "state";
  if (matchesAny(normalizedCity, METRO_CITY_KEYWORDS)) return "metro";
  return "rest";
}

export function calculateZone(city?: string | null, state?: string | null): string | null {
  switch (classifyLocation(city, state)) {
    case "city":
      return ZONE_WITHIN_CITY;
    case "state":
      return ZONE_WITHIN_STATE;
    case "metro":
    case "rest":
      return ZONE_INTER_STATE;
    default:
      return null;
  }
}

export function calculateTier(city?: string | null, state?: string | null): string | null {
  switch (classifyLocation(city, state)) {
    case "city":
      return TIER_CITY;
    case "state":
      return TIER_STATE;
    case "metro":
      return TIER_METRO;
    case "rest":
      return TIER_REST;
    default:
      return null;
  }
}

/**
 * TAT in days, derived from the assigned tier.
 *
 *  - Tier 1 → 3 days
 *  - Tier 2 → 4 days
 *  - Tier 3 → 5 days
 *  - Tier 4 → 8 days
 *  - ODA location present → +2 days on top of any tier
 *
 * Tier is derived from city/state when not supplied, so callers only need to
 * pass the ODA location. Returns null when no tier can be determined.
 */
export function calculateTatDays(
  city?: string | null,
  state?: string | null,
  odaLocation?: string | null
): number | null {
  const tier = calculateTier(city, state);
  if (!tier) return null;

  const baseDays = TAT_DAYS_BY_TIER[tier];
  return hasOdaLocation(odaLocation) ? baseDays + ODA_TAT_UPLIFT_DAYS : baseDays;
}

/**
 * Expected delivery date = SLA start date + the delivery TAT, counted in
 * business days. Saturday and Sunday never count, and a weekend SLA start
 * rolls forward to the next business day before counting begins.
 *
 * The SLA start date is day zero, so a 3 day TAT starting Monday lands on
 * Thursday. Returns null unless both inputs are usable, so the field stays
 * blank while the SLA date or the TAT is still unknown.
 */
export function calculateExpectedDeliveryDate(
  slaStartDate?: string | Date | null,
  tatDays?: number | null
): string | null {
  if (tatDays === null || tatDays === undefined || tatDays < 0) return null;
  const start = toDate(slaStartDate);
  if (!start) return null;
  return formatISODate(addBusinessDays(start, tatDays));
}

/**
 * Steps forward `days` business days, skipping Saturday and Sunday. Each step
 * advances a calendar day first, so the start date itself is day zero.
 */
function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let remaining = days;

  // A weekend SLA start would push the first counted day into the next week.
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  if (remaining === 0) return d;

  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) remaining--;
  }
  return d;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Accepts "YYYY-MM-DD", a full ISO timestamp or a Date, returns a local-midnight Date. */
function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * ODA is stored as a strict Yes/No. Only an explicit positive token counts —
 * anything a user might type, including flag words ("Yes"/"No") or junk, is
 * coerced to a clean value by normalizeOdaLocation() first.
 */
export function hasOdaLocation(odaLocation?: string | null): boolean {
  const normalized = normalizeOda(odaLocation);
  if (!normalized) return false;
  return POSITIVE_ODA_KEYWORDS.includes(normalized);
}

/**
 * Coerces any free-text ODA value to a clean "Yes"/"No" before it is stored,
 * so junk like "abcdefgh" or flag tokens no longer sneak into the column.
 * Only "yes"/"y"/"true"/"1"/"oda" map to "Yes"; everything else maps to "No".
 */
export function normalizeOdaLocation(odaLocation?: string | null): string {
  return hasOdaLocation(odaLocation) ? "Yes" : "No";
}

function normalizeOda(value?: string | null): string {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Matches on substring so district names returned by the pincode API are
 * covered too — e.g. "Bangalore Urban", "New Delhi", "North West Delhi",
 * "Mumbai Suburban", "Chennai Corporation".
 */
function matchesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function normalize(value?: string | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
