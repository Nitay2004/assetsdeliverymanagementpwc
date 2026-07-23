import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serial = req.nextUrl.searchParams.get("serial");
  if (!serial) {
    return NextResponse.json({ error: "Serial number required" }, { status: 400 });
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { serialNumber: { equals: serial.trim(), mode: "insensitive" } },
    select: {
      id: true,
      serialNumber: true,
      model: true,
      status: true,
      employeeName: true,
      invoicingWarehouse: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}
