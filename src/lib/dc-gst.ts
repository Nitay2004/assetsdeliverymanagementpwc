// GST place-of-supply helpers for Delivery Challans.
//
// An intra-state supply (shipper and consignee in the same state) is taxed as
// CGST + SGST, each half the product rate. An inter-state supply is taxed as a
// single IGST at the full product rate. These helpers are shared by the server
// actions that create a DC and by the client modals that preview one, so the
// preview always matches the challan that actually gets stored.

// Locations in this app are free-form strings that may carry a full state name
// ("Kolkata, West Bengal, 700001"), just a city ("Kolkata"), or a state code.
// City names are common — the warehouse defaults are 'Kolkata', 'Bangalore',
// 'Gurgaon' — so cities are mapped to their state before falling back to null.
export const CITY_TO_STATE: Record<string, string> = {
  kolkata: "west bengal", howrah: "west bengal", siliguri: "west bengal", durgapur: "west bengal",
  bangalore: "karnataka", bengaluru: "karnataka", mysore: "karnataka", mangalore: "karnataka", hubli: "karnataka",
  gurgaon: "haryana", gurugram: "haryana", faridabad: "haryana", panipat: "haryana", hisar: "haryana",
  mumbai: "maharashtra", pune: "maharashtra", nagpur: "maharashtra", nashik: "maharashtra", thane: "maharashtra",
  chennai: "tamil nadu", coimbatore: "tamil nadu", madurai: "tamil nadu", trichy: "tamil nadu", salem: "tamil nadu",
  noida: "uttar pradesh", lucknow: "uttar pradesh", kanpur: "uttar pradesh", agra: "uttar pradesh", varanasi: "uttar pradesh", ghaziabad: "uttar pradesh",
  delhi: "delhi", "new delhi": "delhi",
  hyderabad: "telangana", secunderabad: "telangana", warangal: "telangana",
  ahmedabad: "gujarat", surat: "gujarat", vadodara: "gujarat", rajkot: "gujarat", gandhinagar: "gujarat",
  jaipur: "rajasthan", jodhpur: "rajasthan", udaipur: "rajasthan",
  chandigarh: "chandigarh", mohali: "punjab", ludhiana: "punjab", amritsar: "punjab", jalandhar: "punjab",
  indore: "madhya pradesh", bhopal: "madhya pradesh", jabalpur: "madhya pradesh", gwalior: "madhya pradesh",
  patna: "bihar", gaya: "bihar", muzaffarpur: "bihar",
  ranchi: "jharkhand", jamshedpur: "jharkhand", dhanbad: "jharkhand",
  bhubaneswar: "odisha", cuttack: "odisha", rourkela: "odisha",
  kochi: "kerala", cochin: "kerala", thiruvananthapuram: "kerala", kozhikode: "kerala",
  guwahati: "assam", dispur: "assam",
  raipur: "chhattisgarh", bilaspur: "chhattisgarh",
  dehradun: "uttarakhand", haridwar: "uttarakhand",
  goa: "goa", panaji: "goa",
  shimla: "himachal pradesh", solan: "himachal pradesh",
  srinagar: "jammu and kashmir", jammu: "jammu and kashmir",
  puducherry: "puducherry", pondicherry: "puducherry",
  visakhapatnam: "andhra pradesh", vijayawada: "andhra pradesh", guntur: "andhra pradesh", tirupati: "andhra pradesh",
};

/**
 * Best-effort state name for a free-form location, or null when the string
 * carries no recognisable state or city.
 */
export function getStateFromLocation(loc: string | null | undefined): string | null {
  if (!loc) return null;
  const text = loc.toLowerCase();
  const states = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh", "uttarakhand", "west bengal",
    "delhi", "jammu and kashmir", "ladakh", "chandigarh", "puducherry", "andaman and nicobar", "daman and diu", "dadra and nagar haveli", "lakshadweep",
  ];
  for (const s of states) {
    if (text.includes(s)) return s;
  }
  // Match a standalone city token (whole word) to avoid false positives inside
  // other words.
  const tokens = text.match(/[a-z]+/g) ?? [];
  for (const token of tokens) {
    const mapped = CITY_TO_STATE[token];
    if (mapped) return mapped;
  }
  return null;
}

/**
 * True only when both locations resolve to the same non-empty state. When either
 * is unknown the supply is treated as inter-state (IGST), which is the
 * conservative GST treatment.
 */
export function isIntraStateSupply(
  shipperLocation: string | null | undefined,
  consigneeLocation: string | null | undefined
): boolean {
  const shipper = getStateFromLocation(shipperLocation);
  const consignee = getStateFromLocation(consigneeLocation);
  return !!shipper && !!consignee && shipper === consignee;
}
