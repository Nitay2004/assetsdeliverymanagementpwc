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

const NEGATIVE_ODA_KEYWORDS = [
  "no",
  "n",
  "na",
  "n a",
  "none",
  "nil",
  "nope",
  "not applicable",
  "not oda",
  "false",
  "0",
];

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
 * ODA is free text, so "No", "N", "NA", "None", "nil" and "0" all mean
 * "not an ODA location" and must not add the uplift.
 */
export function hasOdaLocation(odaLocation?: string | null): boolean {
  const normalized = normalize(odaLocation);
  if (!normalized) return false;
  return !NEGATIVE_ODA_KEYWORDS.some((keyword) => normalized === keyword);
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
