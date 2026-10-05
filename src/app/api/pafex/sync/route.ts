import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canViewModule } from "@/lib/permissions";
import { saveFile, POD_BUCKET } from "@/lib/storage";
import { calculateSlaStatus } from "@/lib/sla-utils";
import {
  fetchTracking,
  downloadPod,
  latestEvent,
  deliveredAt,
  isDeliveredState,
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

const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  "DELIVERED",
  "DELIVERY_CONFIRMED",
  "INVOICED",
  "WARRANTY_UPDATED",
  "CANCELLED",
  "RTO",
  "RTO_DC_REQUESTED",
  "RTO_DC_GENERATED",
  "RTO_EWAY_BILL_REQUESTED",
  "RTO_EWAY_BILL_GENERATED",
  "RTO_IN_TRANSIT",
  "RTO_DELIVERED_TO_WAREHOUSE",
];

type DocketCandidate = {
  id: string;
  docketNumber: string;
  podDocumentUrl: string | null;
  orderId: string;
  orderStatus: OrderStatus;
};

type SyncOutcome = {
  docketNumber: string;
  docketId: string;
  orderId: string;
  orderStatus: string;
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

async function itemIdsForOrder(orderId: string): Promise<string[]> {
  const assets = await prisma.asset.findMany({
    where: { orderId, inventoryItemId: { not: null } },
    select: { inventoryItemId: true },
  });
  return assets.map(a => a.inventoryItemId).filter(Boolean) as string[];
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

async function markItemsDelivered(itemIds: string[], deliveredOn: Date): Promise<number> {
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
        ...dates,
        slaStatus: calculateSlaStatus(dates.actualDeliveryDate, item.expectedDeliveryDate),
      },
    });
  }

  return items.length;
}

async function fetchAndStorePod(
  tracking: PafexTracking,
  docketId: string,
  dryRun: boolean
): Promise<{ pod: SyncOutcome["pod"]; podError?: string }> {
  if (!tracking.pod_image) return { pod: "unavailable" };
  if (dryRun) return { pod: "skipped" };

  try {
    const file = await downloadPod(tracking.pod_image);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.extension}`;
    const filePath = await saveFile(`${POD_BUCKET}/${fileName}`, file.buffer);
    await prisma.docket.update({ where: { id: docketId }, data: { podDocumentUrl: filePath } });
    return { pod: "fetched" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "POD download failed";
    return { pod: "failed", podError: message };
  }
}

async function syncDocket(docket: DocketCandidate, dryRun: boolean): Promise<SyncOutcome> {
  const outcome: SyncOutcome = {
    docketNumber: docket.docketNumber,
    docketId: docket.id,
    orderId: docket.orderId,
    orderStatus: docket.orderStatus,
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
    if (!dryRun) {
      await prisma.docket.update({
        where: { id: docket.id },
        data: { pafexTrackingFound: false, lastTrackingSyncAt: new Date() },
      });
    }
    outcome.pod = "skipped";
    return outcome;
  }

  const event = latestEvent(tracking);
  const state = event?.event_state ?? null;
  const delivered = isDeliveredState(state);

  outcome.pafexStatus = state;
  outcome.pafexDescription = event?.event_description ?? null;

  if (dryRun) {
    outcome.pod = tracking.pod_image ? "skipped" : "unavailable";
    if (delivered && docket.podDocumentUrl) outcome.pod = "already_present";
    return outcome;
  }

  await prisma.docket.update({
    where: { id: docket.id },
    data: {
      pafexTrackingFound: true,
      courierTrackingStatus: state,
      courierTrackingDescription: event?.event_description ?? null,
      lastTrackingEventAt: event?.event_at ? new Date(event.event_at.replace(" ", "T")) : null,
      lastTrackingSyncAt: new Date(),
    },
  });

  if (delivered) {
    const itemIds = await itemIdsForOrder(docket.orderId);
    const on = deliveredAt(tracking) ?? new Date();

    if (!TERMINAL_ORDER_STATUSES.includes(docket.orderStatus)) {
      await prisma.order.update({ where: { id: docket.orderId }, data: { status: "DELIVERED" } });
      outcome.orderStatusChanged = "DELIVERED";
    }

    outcome.itemsUpdated = await markItemsDelivered(itemIds, on);

    if (docket.podDocumentUrl) {
      outcome.pod = "already_present";
    } else {
      const pod = await fetchAndStorePod(tracking, docket.id, dryRun);
      outcome.pod = pod.pod;
      if (pod.podError) outcome.podError = pod.podError;
    }
    return outcome;
  }

  if (isInTransitState(state)) {
    if (docket.orderStatus === "PACKED_AND_LABELLED") {
      await prisma.order.update({ where: { id: docket.orderId }, data: { status: "DISPATCHED" } });
      outcome.orderStatusChanged = "DISPATCHED";
    }
    outcome.itemsUpdated = await markItemsInTransit(await itemIdsForOrder(docket.orderId));
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

    const candidates = await prisma.docket.findMany({
      where: {
        docketNumber: { not: null },
        OR: [
          { podDocumentUrl: null },
          { order: { status: { notIn: TERMINAL_ORDER_STATUSES } } },
        ],
      },
      select: {
        id: true,
        docketNumber: true,
        podDocumentUrl: true,
        orderId: true,
        order: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const dockets: DocketCandidate[] = candidates.map(d => ({
      id: d.id,
      docketNumber: d.docketNumber as string,
      podDocumentUrl: d.podDocumentUrl,
      orderId: d.orderId,
      orderStatus: d.order.status,
    }));

    const results = await runWithConcurrency(dockets, CONCURRENCY, docket =>
      syncDocket(docket, dryRun)
    );

    const notFoundDockets = results
      .filter(r => !r.error && r.pafexStatus === null)
      .map(r => r.docketNumber);
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
      ordersAdvanced: results.filter(r => r.orderStatusChanged).length,
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