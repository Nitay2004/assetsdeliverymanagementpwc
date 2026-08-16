import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile, podFileUrl, POD_BUCKET } from "@/lib/storage";

const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];

const trackingStatusMap: Record<string, string> = {
  DELIVERED: "Delivered",
  DELIVERY_CONFIRMED: "Delivery Confirmed",
};

function authorized(req: NextRequest): boolean {
  const key = process.env.POD_API_KEY;
  if (!key) return true;
  return req.headers.get("x-api-key") === key;
}

export async function POST(req: NextRequest) {
  try {
    if (!authorized(req)) {
      return NextResponse.json({ error: "Invalid or missing x-api-key header" }, { status: 401 });
    }

    const formData = await req.formData();
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

    const deliveryDate = deliveryDateRaw ? new Date(`${deliveryDateRaw}T00:00:00`) : null;
    if (deliveryDateRaw && deliveryDate && Number.isNaN(deliveryDate.getTime())) {
      return NextResponse.json({ error: "Invalid deliveryDate. Use YYYY-MM-DD format." }, { status: 400 });
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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = await saveFile(`${POD_BUCKET}/${fileName}`, buffer);

    await prisma.docket.updateMany({
      where: { id: { in: dockets.map(d => d.id) } },
      data: { podDocumentUrl: filePath },
    });

    const orderIds = [...new Set(dockets.map(d => d.orderId))];
    const delivered: { orderId: string; items: number }[] = [];

    for (const orderId of orderIds) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (!order) continue;

      const assets = await prisma.asset.findMany({
        where: { orderId, inventoryItemId: { not: null } },
        select: { inventoryItemId: true },
      });
      const itemIds = assets.map(a => a.inventoryItemId).filter(Boolean) as string[];

      if (order.status === "DISPATCHED" || order.status === "DELIVERY_CONFIRMED") {
        await prisma.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
      }

      if (itemIds.length > 0) {
        const now = deliveryDate ?? new Date();
        const items = await prisma.inventoryItem.findMany({
          where: { id: { in: itemIds } },
          select: {
            id: true,
            outwardDate1: true,
            outwardDate2: true,
            outwardDate3: true,
            outwardDate4: true,
            outwardDate5: true,
            outwardDate6: true,
          },
        });
        for (const item of items) {
          const dateToSet: Record<string, Date> = {
            deliveryDate: now,
            actualDeliveryDate: now,
          };
          if (!item.outwardDate1) dateToSet.outwardDate1 = now;
          else if (!item.outwardDate2) dateToSet.outwardDate2 = now;
          else if (!item.outwardDate3) dateToSet.outwardDate3 = now;
          else if (!item.outwardDate4) dateToSet.outwardDate4 = now;
          else if (!item.outwardDate5) dateToSet.outwardDate5 = now;
          else if (!item.outwardDate6) dateToSet.outwardDate6 = now;
          await prisma.inventoryItem.update({
            where: { id: item.id },
            data: { trackingStatus: trackingStatusMap["DELIVERED"], ...dateToSet },
          });
        }
        delivered.push({ orderId, items: itemIds.length });
      }
    }

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
