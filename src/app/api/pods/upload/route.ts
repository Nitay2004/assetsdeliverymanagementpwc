import { NextRequest, NextResponse } from "next/server";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveFile, podFileUrl, POD_BUCKET } from "@/lib/storage";
import { getSession } from "@/lib/auth";
import { canModuleAction } from "@/lib/permissions";
import { calculateSlaStatus } from "@/lib/sla-utils";
import { parseDateOnlyUtc, todayDateOnlyUtc } from "@/lib/date-only";
import { timingSafeEqual } from "crypto";

const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const trackingStatusMap: Record<string, string> = {
  DELIVERED: "Delivered",
  DELIVERY_CONFIRMED: "Delivery Confirmed",
};

function authorized(req: NextRequest): boolean {
  const key = process.env.POD_API_KEY;
  if (!key) return false;
  const header = req.headers.get("x-api-key");
  if (!header) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const MAGIC_BYTES: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
};

function matchesMagic(buffer: Buffer, ext: string): boolean {
  const magic = MAGIC_BYTES[ext];
  if (!magic) return false;
  if (buffer.length < magic.length) return false;
  return magic.every((byte, i) => buffer[i] === byte);
}

// Date-only fields are stored as @db.Date. Building them from local midnight
// shifts the stored day for anyone east of UTC, so parseDateOnlyUtc (from
// @/lib/date-only) parses as UTC and rejects impossible dates such as
// 2026-02-31 (which JS would silently roll over).

const POD_ALLOWED_ORDER_STATUSES = new Set<string>(["DISPATCHED", "DELIVERY_CONFIRMED", "DELIVERED"]);
const POD_DELIVERABLE_ORDER_STATUSES = new Set<OrderStatus>(["DISPATCHED", "DELIVERY_CONFIRMED"]);

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSession();
    const apiKeyAuth = authorized(req);
    // View-only access must not be enough: this endpoint writes the POD and
    // flips the order to DELIVERED.
    const moduleAuth =
      !!sessionUser &&
      (canModuleAction(sessionUser.permissions, sessionUser.role, "logistics", "canEdit") ||
        canModuleAction(sessionUser.permissions, sessionUser.role, "warehouse", "canEdit"));
    if (!apiKeyAuth && !moduleAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A caller that omits the multipart boundary makes formData() throw. That is a
    // client error, not a server fault, so answer 400 instead of letting the outer
    // catch below turn it into a 500.
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Request must be multipart/form-data with field 'file'." },
        { status: 400 },
      );
    }
    const file = formData.get("file") as File | null;
    const docketNumberRaw = (formData.get("docketNumber") as string | null)?.trim() ?? "";
    const deliveryDateRaw = (formData.get("deliveryDate") as string | null)?.trim() || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided. Send multipart field 'file'." }, { status: 400 });
    }
    if (!docketNumberRaw) {
      return NextResponse.json({ error: "Missing docketNumber. Send multipart field 'docketNumber'." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: "Only PDF, JPG, and PNG files are allowed" }, { status: 400 });
    }

    // Reject an oversized upload from the declared size before buffering the
    // whole body into memory.
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds the 10 MB limit" }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds the 10 MB limit" }, { status: 413 });
    }
    if (!matchesMagic(buffer, ext)) {
      return NextResponse.json({ error: "File content does not match its extension" }, { status: 400 });
    }

    const deliveryDate = deliveryDateRaw ? parseDateOnlyUtc(deliveryDateRaw) : null;
    if (deliveryDateRaw && !deliveryDate) {
      return NextResponse.json({ error: "Invalid deliveryDate. Use a real YYYY-MM-DD date." }, { status: 400 });
    }

    const dockets = await prisma.docket.findMany({
      where: { docketNumber: { equals: docketNumberRaw, mode: "insensitive" } },
      select: { id: true, orderId: true },
    });

    if (dockets.length === 0) {
      return NextResponse.json(
        { error: `No docket found with number "${docketNumberRaw}".`, hint: "Check the docket number on the logistics dashboard." },
        { status: 404 }
      );
    }

    const orderIds = [...new Set(dockets.map(d => d.orderId))];
    // One docket number must not fan out across multiple orders: that would
    // attach this POD and delivery stamp to unrelated shipments.
    if (orderIds.length > 1) {
      return NextResponse.json(
        {
          error: `Docket number "${docketNumberRaw}" belongs to ${orderIds.length} different orders. Refusing to update all of them.`,
          orderIds,
        },
        { status: 409 }
      );
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, status: true },
    });
    const orderById = new Map(orders.map(o => [o.id, o]));
    const invalidOrders = orderIds
      .map(id => ({ id, status: orderById.get(id)?.status ?? "NOT_FOUND" }))
      .filter(o => !POD_ALLOWED_ORDER_STATUSES.has(o.status));
    if (invalidOrders.length > 0) {
      return NextResponse.json(
        {
          error: "POD can only be uploaded for dispatched, delivery-confirmed or already delivered orders.",
          orders: invalidOrders,
        },
        { status: 409 }
      );
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = await saveFile(`${POD_BUCKET}/${fileName}`, buffer);

    const delivered = await prisma.$transaction(async (tx) => {
      // Lock the orders so their status cannot change between the check and
      // the POD write. Re-read after locking because the snapshot above may be
      // stale by now.
      await tx.$queryRaw`
        SELECT id FROM orders WHERE id IN (${Prisma.join(orderIds)}) FOR UPDATE
      `;
      const freshOrders = await tx.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, status: true },
      });
      if (
        freshOrders.length !== orderIds.length ||
        freshOrders.some(o => !POD_ALLOWED_ORDER_STATUSES.has(o.status))
      ) {
        throw new Error("Order status changed. POD upload was cancelled.");
      }
      const freshOrderById = new Map(freshOrders.map(o => [o.id, o]));

      await tx.docket.updateMany({
        where: { id: { in: dockets.map(d => d.id) } },
        data: { podDocumentUrl: filePath },
      });

      const updated: { orderId: string; items: number }[] = [];
      for (const orderId of orderIds) {
        const status = freshOrderById.get(orderId)?.status;
        // Re-uploading a POD for an order that is already DELIVERED only
        // replaces the document. It must not move dates or status again.
        if (!status || !POD_DELIVERABLE_ORDER_STATUSES.has(status)) continue;

        // Claim the transition atomically. If another request already moved the
        // order, this matches zero rows and we leave its item dates alone.
        const claimed = await tx.order.updateMany({
          where: {
            id: orderId,
            status: { in: [...POD_DELIVERABLE_ORDER_STATUSES] },
          },
          data: { status: "DELIVERED" },
        });
        if (claimed.count === 0) continue;

        const assets = await tx.asset.findMany({
          where: { orderId, inventoryItemId: { not: null } },
          select: { inventoryItemId: true },
        });
        const itemIds = assets.map(a => a.inventoryItemId).filter(Boolean) as string[];
        if (itemIds.length === 0) continue;

        // Without an explicit delivery date, fall back to today's calendar day as
        // UTC midnight so the @db.Date columns store the intended day.
        const now = deliveryDate ?? todayDateOnlyUtc();
        const items = await tx.inventoryItem.findMany({
          where: { id: { in: itemIds } },
          select: {
            id: true,
            expectedDeliveryDate: true,
            actualDeliveryDate: true,
            outwardDate1: true,
            outwardDate2: true,
            outwardDate3: true,
            outwardDate4: true,
            outwardDate5: true,
            outwardDate6: true,
          },
        });
        for (const item of items) {
          const actualDelivery = item.actualDeliveryDate ?? now;
          const dateToSet: Record<string, Date> = {
            deliveryDate: now,
            actualDeliveryDate: actualDelivery,
          };
          if (!item.outwardDate1) dateToSet.outwardDate1 = now;
          else if (!item.outwardDate2) dateToSet.outwardDate2 = now;
          else if (!item.outwardDate3) dateToSet.outwardDate3 = now;
          else if (!item.outwardDate4) dateToSet.outwardDate4 = now;
          else if (!item.outwardDate5) dateToSet.outwardDate5 = now;
          else if (!item.outwardDate6) dateToSet.outwardDate6 = now;
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: {
              trackingStatus: trackingStatusMap["DELIVERED"],
              ...dateToSet,
              slaStatus: calculateSlaStatus(actualDelivery, item.expectedDeliveryDate),
            },
          });
        }
        // Terminal order: free the physical asset for a future allocation
        // (the partial unique index ignores "released" history rows).
        await tx.asset.updateMany({
          where: { orderId, status: { not: "released" } },
          data: { status: "released" },
        });
        updated.push({ orderId, items: itemIds.length });
      }
      return updated;
    });

    return NextResponse.json({
      success: true,
      podUrl: await podFileUrl(filePath),
      filePath,
      dockets: dockets.map(d => d.id),
      ordersUpdated: delivered.length,
      delivered,
    });
  } catch (err) {
    console.error("POD upload error:", err);
    return NextResponse.json({ error: "POD upload failed" }, { status: 500 });
  }
}
