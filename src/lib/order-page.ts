import { prisma } from "@/lib/prisma";
import type { OrderStatus, Prisma } from "@prisma/client";

export async function getCorrectOrderPage(
  orderId: string,
  statusFilter: OrderStatus[],
  pageSize: number,
): Promise<number | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdAt: true, status: true },
  });
  if (!order || !statusFilter.includes(order.status)) return null;

  // Ordered by createdAt (not updatedAt) so that saving an order never moves it
  // to another page — that is what made rows look like they vanished.
  const position = await prisma.order.count({
    where: {
      status: { in: statusFilter },
      createdAt: { gt: order.createdAt },
    },
  });

  return Math.floor(position / pageSize) + 1;
}
