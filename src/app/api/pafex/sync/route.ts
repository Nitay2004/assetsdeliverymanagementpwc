import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canViewModule } from "@/lib/permissions";
import { saveFile, POD_BUCKET } from "@/lib/storage";
import { calculateSlaStatus } from "@/lib/sla-utils";
import {
  fetchTracking,
  downloadPod,
  latestEvent,
  latestDeliveredEvent,
  deliveredAt,
  isInTransitState,
  labelForState,
  pafexConfigured,
  PafexNotConfiguredError,
  type PafexTracking,
} from "@/lib/pafex";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CONCURRENCY = 4;
const TRACKING_STATUS_DISPATCHED = "Dispatched";
const TRACKING_STATUS_DELIVERED = "Delivered";

// Pafex only carries the couriers we hand it, so only dockets booked through
// that account are worth a lookup. Configurable in .env because the courier mix
// changes as more shippers move onto Pafex.
const DEFAULT_COURIER_NAMES = "Blue Dart";

function courierFilter(): { in: string[] } | null {
  const raw = process.env.PAFEX_COURIER_NAMES ?? DEFAULT_COURIER_NAMES;
  const names = raw
    .split(",")
    .map(n => n.trim())
    .filter(Boolean);
  return names.length > 0 ? { in: names } : null;
}

// The sync walks the docket numbers that sit on the inventory items, because
// that is where a serial number actually lives. Orders are advanced as a side
// effect only when a Docket row happens to exist for that docket number.
type DocketCandidate = {
  docketNumber: string;
  itemIds: string[];
  hasPod: boolean;
  docketId: string | null;
  orderId: string | null;
  orderStatus: string | null;
};

type SyncOutcome = {
  docketNumber: string;
  docketId: string | null;
  orderId: string | null;
  orderStatus: string | null;
  found: boolean;
  pafexStatus: string | null;
  pafexDescription: string | null;
  orderStatusChanged: string | null;
  itemsUpdated: number;
  pod: "fetched" | "already_present" | "unavailable" | "skipped" | "failed";
  podError?: string;
  error?: string;
};

function authorized(req: NextRequest): boolean {
  const key = process.env.PAFEX_SYNC_API_KEY;
  if (!key) return false;
  const header = req.headers.get("x-api-key");
  if (!header) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

async function markItemsInTransit(itemIds: string[]): Promise<number> {
  if (itemIds.length === 0) return 0;
  const result = await prisma.inventoryItem.updateMany({
    where: { id: { in: itemIds } },
    data: {
      trackingStatus: TRACKING_STATUS_DISPATCHED,
      trackingSubStatus: labelForState("in_transit"),
    },
  });
  return result.count;
}

async function markItemsDelivered(
  itemIds: string[],
  deliveredOn: Date,
  docketNumber: string
): Promise<number> {
  if (itemIds.length === 0) return 0;

  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds } },
    select: {
      id: true,
      expectedDeliveryDate: true,
      outwardDate1: true,
      outwardDate2: true,
      outwardDate3: true,
      outwardDate4: true,
      outwardDate5: true,
      outwardDate6: true,
    },
  });

  for (const item of items) {
    const dates: Record<string, Date> = {
      deliveryDate: deliveredOn,
      actualDeliveryDate: deliveredOn,
      latestDeliveryDate: deliveredOn,
    };
    if (!item.outwardDate1) dates.outwardDate1 = deliveredOn;
    else if (!item.outwardDate2) dates.outwardDate2 = deliveredOn;
    else if (!item.outwardDate3) dates.outwardDate3 = deliveredOn;
    else if (!item.outwardDate4) dates.outwardDate4 = deliveredOn;
    else if (!item.outwardDate5) dates.outwardDate5 = deliveredOn;
    else if (!item.outwardDate6) dates.outwardDate6 = deliveredOn;

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        trackingStatus: TRACKING_STATUS_DELIVERED,
        trackingSubStatus: labelForState("delivered"),
        latestDocketNumber: docketNumber,
        latestTrackingStatus: TRACKING_STATUS_DELIVERED,
        ...dates,
        slaStatus: calculateSlaStatus(dates.actualDeliveryDate, item.expectedDeliveryDate),
      },
    });
  }

  return items.length;
}

async function fetchAndStorePod(
  tracking: PafexTracking,
  itemIds: string[],
  dryRun: boolean
): Promise<{ pod: SyncOutcome["pod"]; podError?: string }> {
  if (!tracking.pod_image) return { pod: "unavailable" };
  if (dryRun) return { pod: "skipped" };

  try {
    const file = await downloadPod(tracking.pod_image);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.extension}`;
    const filePath = await saveFile(`${POD_BUCKET}/${fileName}`, file.buffer);
    await prisma.inventoryItem.updateMany({
      where: { id: { in: itemIds } },
      data: { podDocumentUrl: filePath },
    });
    return { pod: "fetched" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "POD download failed";
    return { pod: "failed", podError: message };
  }
}

async function loadCandidates(limit: number): Promise<DocketCandidate[]> {
  // Distinct docket numbers straight off the inventory items, skipping the ones
  // whose items are already delivered. Reading the rows newest-first and folding
  // them here keeps the window moving forward, instead of re-checking the same
  // alphabetical slice on every run.
  const couriers = courierFilter();

  const recent = await prisma.inventoryItem.findMany({
    where: {
      docketNumber: { not: null },
      NOT: { trackingStatus: TRACKING_STATUS_DELIVERED },
      ...(couriers ? { latestCourierName: couriers } : {}),
    },
    select: { id: true, docketNumber: true, podDocumentUrl: true },
    orderBy: { updatedAt: "desc" },
    take: limit * 20,
  });

  const byDocket = new Map<string, string[]>();
  const podSet = new Set<string>();
  for (const item of recent) {
    const number = (item.docketNumber as string).trim();
    if (!number || number === "0") continue;
    if (!byDocket.has(number) && byDocket.size >= limit) continue;
    const list = byDocket.get(number);
    if (list) list.push(item.id);
    else byDocket.set(number, [item.id]);
    if (item.podDocumentUrl) podSet.add(number);
  }

  const numbers = [...byDocket.keys()];

  // Pull every item on those dockets, not only the ones inside the recency
  // window, so a whole docket moves to delivered together.
  const allItems = await prisma.inventoryItem.findMany({
    where: {
      docketNumber: { in: numbers },
      ...(couriers ? { latestCourierName: couriers } : {}),
    },
    select: { id: true, docketNumber: true, podDocumentUrl: true },
  });
  for (const item of allItems) {
    const number = (item.docketNumber as string).trim();
    if (!byDocket.has(number)) continue;
    byDocket.get(number)!.push(item.id);
    if (item.podDocumentUrl) podSet.add(number);
  }

  // A Docket row is optional: the inventory is the source of truth, and office
  // has no docket rows at all. When one exists we keep its tracking fields and
  // advance the parent order too.
  const dockets = await prisma.docket.findMany({
    where: { docketNumber: { in: numbers } },
    select: {
      id: true,
      docketNumber: true,
      podDocumentUrl: true,
      orderId: true,
      order: { select: { status: true } },
    },
  });
  const docketByNumber = new Map(
    dockets.map(d => [(d.docketNumber as string).trim(), d])
  );

  return numbers.map(number => {
    const itemIds = byDocket.get(number) ?? [];
    const docket = docketByNumber.get(number);
    const hasPod = podSet.has(number) || !!docket?.podDocumentUrl;
    return {
      docketNumber: number,
      itemIds,
      hasPod,
      docketId: docket?.id ?? null,
      orderId: docket?.orderId ?? null,
      orderStatus: docket?.order.status ?? null,
    };
  });
}

async function syncDocket(docket: DocketCandidate, dryRun: boolean): Promise<SyncOutcome> {
  const outcome: SyncOutcome = {
    docketNumber: docket.docketNumber,
    docketId: docket.docketId,
    orderId: docket.orderId,
    orderStatus: docket.orderStatus,
    found: false,
    pafexStatus: null,
    pafexDescription: null,
    orderStatusChanged: null,
    itemsUpdated: 0,
    pod: "skipped",
  };

  let tracking: PafexTracking | null;
  try {
    tracking = await fetchTracking(docket.docketNumber);
  } catch (err) {
    outcome.error = err instanceof Error ? err.message : "Tracking request failed";
    return outcome;
  }

  if (!tracking) {
    outcome.pod = "skipped";
    return outcome;
  }

  outcome.found = true;

  // A docket counts as delivered when any event says so. Pafex appends in_transit
  // "PODDC IMAGE" scans after the delivery scan, so the newest event alone would
  // report a delivered shipment as still moving.
  const deliveredEvent = latestDeliveredEvent(tracking);
  const event = deliveredEvent ?? latestEvent(tracking);
  const delivered = !!deliveredEvent;
  const state = event?.event_state ?? null;

  outcome.pafexStatus = state;
  outcome.pafexDescription = event?.event_description ?? null;

  if (dryRun) {
    outcome.pod = tracking.pod_image ? "skipped" : "unavailable";
    if (delivered && docket.hasPod) outcome.pod = "already_present";
    return outcome;
  }

  if (docket.docketId) {
    await prisma.docket.update({
      where: { id: docket.docketId },
      data: {
        pafexTrackingFound: true,
        courierTrackingStatus: state,
        courierTrackingDescription: event?.event_description ?? null,
        lastTrackingEventAt: event?.event_at
          ? new Date(event.event_at.replace(" ", "T"))
          : null,
        lastTrackingSyncAt: new Date(),
      },
    });
  }

  if (delivered) {
    const on = deliveredAt(tracking) ?? new Date();
    outcome.itemsUpdated = await markItemsDelivered(docket.itemIds, on, docket.docketNumber);

    if (docket.hasPod) {
      outcome.pod = "already_present";
    } else {
      const pod = await fetchAndStorePod(tracking, docket.itemIds, dryRun);
      outcome.pod = pod.pod;
      if (pod.podError) outcome.podError = pod.podError;
    }
    return outcome;
  }

  if (isInTransitState(state)) {
    outcome.itemsUpdated = await markItemsInTransit(docket.itemIds);
  }

  return outcome;
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSession();
    const apiKeyAuth = authorized(req);
    const moduleAuth =
      !!sessionUser &&
      (canViewModule(sessionUser.permissions, sessionUser.role, "logistics") ||
        canViewModule(sessionUser.permissions, sessionUser.role, "warehouse"));
    if (!apiKeyAuth && !moduleAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!pafexConfigured()) {
      return NextResponse.json(
        {
          error:
            "PAFEX_API_COMPANY_ID and PAFEX_CUSTOMER_CODE are not set on the server. Add them to .env and redeploy.",
        },
        { status: 503 }
      );
    }

    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
    const requestedLimit = Number(req.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Math.min(
      MAX_LIMIT,
      Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : DEFAULT_LIMIT
    );

    const dockets = await loadCandidates(limit);

    const results = await runWithConcurrency(dockets, CONCURRENCY, docket =>
      syncDocket(docket, dryRun)
    );

    const notFoundDockets = results.filter(r => !r.error && !r.found).map(r => r.docketNumber);
    const failed = results.filter(r => r.error);

    return NextResponse.json({
      success: true,
      dryRun,
      checked: results.length,
      found: results.length - notFoundDockets.length - failed.length,
      notFound: notFoundDockets.length,
      notFoundDockets,
      failed: failed.length,
      errors: failed.map(f => ({ docketNumber: f.docketNumber, error: f.error })),
      delivered: results.filter(r => r.pafexStatus === "delivered").length,
      podsFetched: results.filter(r => r.pod === "fetched").length,
      itemsUpdated: results.reduce((sum, r) => sum + r.itemsUpdated, 0),
      results,
    });
  } catch (err) {
    if (err instanceof PafexNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Pafex sync error:", err);
    return NextResponse.json({ error: "Pafex sync failed" }, { status: 500 });
  }
}