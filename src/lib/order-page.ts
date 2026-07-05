import { prisma } from "@/lib/prisma";
import type { OrderStatus, Prisma } from "@prisma/client";

export async function getCorrectOrderPage(
  orderId: string,
  statusFilter: OrderStatus[],
  pageSize: number,
): Promise<number | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { updatedAt: true, status: true },
  });
  if (!order || !statusFilter.includes(order.status)) return null;

  const position = await prisma.order.count({
    where: {
      status: { in: statusFilter },
      updatedAt: { gt: order.updatedAt },
    },
  });

  return Math.floor(position / pageSize) + 1;
}
