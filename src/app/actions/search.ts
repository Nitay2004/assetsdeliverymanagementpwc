"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canViewModule } from "@/lib/permissions";

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-zA-Z0-9\s\-_.@#/]/g, "")
    .trim()
    .slice(0, 100);
}

export interface SearchResult {
  type: "inventory" | "order" | "asset" | "docket";
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

export async function globalSearch(raw: string): Promise<SearchResult[]> {
  const user = await getSession();
  if (!user) return [];

  const q = sanitize(raw);
  if (!q || q.length < 2) return [];

  const results: SearchResult[] = [];

  const [items, orders, assets, dockets] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: {
        OR: [
          { serialNumber: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
          { employeeName: { contains: q, mode: "insensitive" } },
          { emailId: { contains: q, mode: "insensitive" } },
          { mobileNumber: { contains: q, mode: "insensitive" } },
          { purpose: { contains: q, mode: "insensitive" } },
          { trackingStatus: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { clientName: { contains: q, mode: "insensitive" } },
          { deliveryLocation: { contains: q, mode: "insensitive" } },
          { dcNumber: { contains: q, mode: "insensitive" } },
          { invoiceNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.asset.findMany({
      where: {
        status: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        status: true,
        orderId: true,
        inventoryItem: { select: { serialNumber: true } },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    prisma.docket.findMany({
      where: {
        OR: [
          { docketNumber: { contains: q, mode: "insensitive" } },
          { ewayBillNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { order: { select: { clientName: true } } },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  for (const item of items) {
    results.push({
      type: "inventory",
      id: item.id,
      label: item.serialNumber,
      sublabel: `${item.model} — ${item.employeeName || item.status}`,
      href: `/dashboard/inventory?selected=${item.id}`,
    });
  }

  for (const order of orders) {
    results.push({
      type: "order",
      id: order.id,
      label: `Order: ${order.clientName}`,
      sublabel: `${order.deliveryLocation} · ${order.totalQuantity} units · ${order.status}`,
      href: `/dashboard/warehouse/${order.id}`,
    });
  }

  for (const asset of assets) {
    results.push({
      type: "asset",
      id: asset.id,
      label: `Asset: ${asset.inventoryItem?.serialNumber ?? "—"}`,
      sublabel: `Status: ${asset.status}`,
      href: `/dashboard/provisioning?selected=${asset.orderId}`,
    });
  }

  for (const docket of dockets) {
    results.push({
      type: "docket",
      id: docket.id,
      label: `Docket: ${docket.docketNumber ?? "—"}`,
      sublabel: `E-Way: ${docket.ewayBillNumber ?? "—"} · ${docket.order?.clientName ?? ""}`,
      href: `/dashboard/logistics?selected=${docket.orderId}`,
    });
  }

  const canViewResult = (type: SearchResult["type"]) =>
    type === "inventory"
      ? canViewModule(user.permissions, user.role, "inventory")
      : type === "order"
        ? canViewModule(user.permissions, user.role, "warehouse")
        : type === "asset"
          ? canViewModule(user.permissions, user.role, "provisioning")
          : canViewModule(user.permissions, user.role, "logistics");

  return results.filter(r => canViewResult(r.type)).slice(0, 10);
}
