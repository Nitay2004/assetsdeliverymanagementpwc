import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.inventoryItem.findMany({
    where: { status: { in: ["AVAILABLE", "NEW"] } },
    select: {
      id: true,
      serialNumber: true,
      model: true,
      status: true,
      employeeName: true,
      invoicingWarehouse: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}
