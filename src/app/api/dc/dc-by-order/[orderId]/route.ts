import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dcs = await prisma.deliveryChallan.findMany({
    where: { orderId },
    select: { id: true, dcNumber: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(dcs);
}
