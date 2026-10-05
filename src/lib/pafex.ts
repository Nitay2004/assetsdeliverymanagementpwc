const BASE_URL = "https://pafexnew.itdservices.in";
const TRACKING_TIMEOUT_MS = 30_000;
const POD_TIMEOUT_MS = 60_000;
const POD_MAX_BYTES = 10 * 1024 * 1024;

export type PafexEvent = {
  id: string | null;
  docket_id: string | null;
  event_at: string | null;
  event_type: string | null;
  event_description: string | null;
  event_location: string | null;
  event_state: string | null;
  event_remark: string | null;
};

export type PafexTracking = {
  tracking_no: string | null;
  reference_no: string | null;
  forwarding_no: string | null;
  chargeable_weight: string | null;
  expected_datetime: string | null;
  pod_image: string | null;
  pod_signature: string | null;
  docket_info: [string, string][] | null;
  docket_events: PafexEvent[] | null;
};

export type PafexPod = {
  buffer: Buffer;
  extension: "jpg" | "png" | "pdf";
};

export class PafexNotConfiguredError extends Error {}
export class PafexPodTooLargeError extends Error {}

/**
 * Raw Pafex `event_state` values mapped to the labels this app already counts on
 * (the dashboard greps trackingSubStatus for "in transit", "delivered", "rto").
 */
const EVENT_STATE_LABELS: Record<string, string> = {
  entry: "Booked",
  booked: "Booked",
  picked_up: "Picked Up",
  pickup: "Picked Up",
  in_transit: "In Transit",
  intransit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivery: "Out for Delivery",
  delivered: "Delivered",
  undelivered: "Undelivered",
  attempt_failed: "Delivery Attempt Failed",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  rto: "RTO",
  returned: "Returned",
  lost: "Lost",
  damaged: "Damaged",
};

export function pafexConfigured(): boolean {
  return Boolean(process.env.PAFEX_API_COMPANY_ID && process.env.PAFEX_CUSTOMER_CODE);
}

function config(): { apiCompanyId: string; customerCode: string } {
  const apiCompanyId = process.env.PAFEX_API_COMPANY_ID?.trim();
  const customerCode = process.env.PAFEX_CUSTOMER_CODE?.trim();
  if (!apiCompanyId || !customerCode) {
    throw new PafexNotConfiguredError(
      "PAFEX_API_COMPANY_ID and PAFEX_CUSTOMER_CODE must be set to sync Pafex tracking."
    );
  }
  return { apiCompanyId, customerCode };
}

function humanize(state: string): string {
  return state
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

export function labelForState(state: string | null | undefined): string {
  if (!state) return "";
  return EVENT_STATE_LABELS[state.trim().toLowerCase()] ?? humanize(state);
}

export function isDeliveredState(state: string | null | undefined): boolean {
  return (state ?? "").trim().toLowerCase() === "delivered";
}

export function isInTransitState(state: string | null | undefined): boolean {
  const normalized = (state ?? "").trim().toLowerCase();
  return normalized === "in_transit" || normalized === "intransit";
}

/**
 * Pafex returns a single-element array and reports unknown AWBs as
 * `{ errors: true, tracking_no: "AWB number not found" }`, so a miss is `null`
 * rather than an exception.
 */
export async function fetchTracking(trackingNo: string): Promise<PafexTracking | null> {
  const { apiCompanyId, customerCode } = config();
  const url = new URL(`${BASE_URL}/api/tracking_api/get_tracking_data`);
  url.searchParams.set("api_company_id", apiCompanyId);
  url.searchParams.set("customer_code", customerCode);
  url.searchParams.set("tracking_no", trackingNo);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(TRACKING_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Pafex tracking responded ${res.status} for ${trackingNo}`);
  }

  const payload = (await res.json()) as unknown;
  const entry = Array.isArray(payload) ? payload[0] : payload;
  if (!entry || typeof entry !== "object") {
    throw new Error(`Pafex tracking returned an unexpected payload for ${trackingNo}`);
  }

  const record = entry as Record<string, unknown>;
  if (record.errors === true) return null;

  return {
    tracking_no: (record.tracking_no as string) ?? null,
    reference_no: (record.reference_no as string) ?? null,
    forwarding_no: (record.forwarding_no as string) ?? null,
    chargeable_weight: (record.chargeable_weight as string) ?? null,
    expected_datetime: (record.expected_datetime as string) ?? null,
    pod_image: (record.pod_image as string) ?? null,
    pod_signature: (record.pod_signature as string) ?? null,
    docket_info: Array.isArray(record.docket_info) ? (record.docket_info as [string, string][]) : null,
    docket_events: Array.isArray(record.docket_events) ? (record.docket_events as PafexEvent[]) : null,
  };
}

/** Pafex returns events newest-first, but sort defensively so we never trust order. */
export function latestEvent(tracking: PafexTracking): PafexEvent | null {
  const events = (tracking.docket_events ?? []).filter(Boolean);
  if (events.length === 0) return null;

  let best = events[0];
  let bestTime = Date.parse(best.event_at ?? "");
  for (const event of events.slice(1)) {
    const time = Date.parse(event.event_at ?? "");
    if (Number.isNaN(time)) continue;
    if (Number.isNaN(bestTime) || time > bestTime) {
      best = event;
      bestTime = time;
    }
  }
  return best;
}

function parseEventDate(value: string | null): Date | null {
  if (!value) return null;
  // Pafex sends "2026-08-21 19:30:00", which Date.parse reads as local time.
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function deliveredAt(tracking: PafexTracking): Date | null {
  const info = tracking.docket_info ?? [];
  const entry = info.find(([label]) => label.trim().toLowerCase() === "delivery date and time");
  return parseEventDate(entry?.[1] ?? null) ?? parseEventDate(latestEvent(tracking)?.event_at ?? null);
}

function detectExtension(buffer: Buffer, contentType: string | null): PafexPod["extension"] | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("latin1") === "%PDF") return "pdf";

  const type = (contentType ?? "").toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("png")) return "png";
  if (type.includes("pdf")) return "pdf";
  return null;
}

/** `pod_image` points at Pafex's download_file proxy, which is public. */
export async function downloadPod(podImageUrl: string): Promise<PafexPod> {
  const res = await fetch(podImageUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(POD_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Pafex POD download responded ${res.status}`);
  }

  const declaredLength = Number(res.headers.get("content-length") ?? "0");
  if (declaredLength > POD_MAX_BYTES) {
    throw new PafexPodTooLargeError("Pafex POD exceeds the 10 MB limit");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Pafex POD download was empty");
  }
  if (buffer.length > POD_MAX_BYTES) {
    throw new PafexPodTooLargeError("Pafex POD exceeds the 10 MB limit");
  }

  const extension = detectExtension(buffer, res.headers.get("content-type"));
  if (!extension) {
    throw new Error("Pafex POD is not a JPG, PNG, or PDF");
  }

  return { buffer, extension };
}