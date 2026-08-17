import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ partNo: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { partNo } = await params;

  if (!partNo || partNo.length < 2) {
    return NextResponse.json({ product: null });
  }

  const product = await prisma.productMaster.findFirst({
    where: { partNo: { equals: partNo, mode: "insensitive" } },
  });

  if (!product) {
    return NextResponse.json({ product: null });
  }

  return NextResponse.json({
    product: {
      ...product,
      gstRate: product.gstRate ? Number(product.gstRate) : null,
    },
  });
}
