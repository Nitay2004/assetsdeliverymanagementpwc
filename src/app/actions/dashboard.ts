"use server";

import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";

export interface TableOrderData {
  id: string;
  clientName: string;
  deliveryLocation: string;
  totalQuantity: number;
  status: string;
  dcNumber: string | null;
  assets: { id: string; inventoryItem: { serialNumber: string } | null }[];
  dockets: { docketNumber: string | null }[];
}

export async function getOrdersByStatus(
  statuses: OrderStatus[],
  page: number = 1,
  limit: number = 50
): Promise<{ orders: TableOrderData[]; total: number }> {
  const skip = (page - 1) * limit;

  const [rawOrders, total] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: statuses } },
      include: {
        assets: { include: { inventoryItem: true } },
        dockets: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({
      where: { status: { in: statuses } },
    }),
  ]);

  const orders = rawOrders.map(o => ({
    id: o.id,
    clientName: o.clientName,
    deliveryLocation: o.deliveryLocation,
    totalQuantity: o.totalQuantity,
    status: o.status,
    dcNumber: o.dcNumber,
    assets: o.assets.map(a => ({
      id: a.id,
      inventoryItem: a.inventoryItem ? { serialNumber: a.inventoryItem.serialNumber } : null,
    })),
    dockets: o.dockets.map(d => ({ docketNumber: d.docketNumber })),
  }));

  return { orders, total };
}
