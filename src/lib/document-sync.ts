import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// One place that pushes app-generated document references back to Inventory.
//
// Every document mutation (DC generate, docket add/edit, docket edit, POD
// upload, RTO) used to hand-write its own inventoryItem.updateMany. Some paths
// forgot one field, others wrote a docket number into a DC column. This helper
// is the single mapping:
//
//   Order.dcNumber      → dcNumber, latestDc
//   latest Docket       → docketNumber, latestDocketNumber, latestEwayBill
//   Docket with POD     → podDocumentUrl
//
// Terminal return/cancel states deliberately keep Inventory clear: order-sync
// already moves those units back to stock and wipes the assignment references.
// ─────────────────────────────────────────────────────────────────────────────

const STATES_THAT_CLEAR_INVENTORY_REFERENCES = new Set(["RTO_DELIVERED_TO_WAREHOUSE", "CANCELLED"]);

export interface DocumentSyncResult {
  updated: number;
  skipped: "not-found" | "no-assets" | "terminal-state" | null;
}

export async function syncOrderDocumentsToInventory(
  orderId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<DocumentSyncResult> {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      dcNumber: true,
      assets: {
        where: { inventoryItemId: { not: null } },
        select: { inventoryItemId: true },
      },
      dockets: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { docketNumber: true, ewayBillNumber: true, podDocumentUrl: true },
      },
    },
  });

  if (!order) return { updated: 0, skipped: "not-found" };
  if (STATES_THAT_CLEAR_INVENTORY_REFERENCES.has(order.status)) {
    return { updated: 0, skipped: "terminal-state" };
  }

  const itemIds = order.assets
    .map(asset => asset.inventoryItemId)
    .filter((id): id is string => Boolean(id));
  if (itemIds.length === 0) return { updated: 0, skipped: "no-assets" };

  const latestDocket = order.dockets[0];
  const docketWithPod = order.dockets.find(docket => Boolean(docket.podDocumentUrl));

  const data: Prisma.InventoryItemUncheckedUpdateManyInput = {};
  if (order.dcNumber) {
    data.dcNumber = order.dcNumber;
    data.latestDc = order.dcNumber;
  }
  if (latestDocket?.docketNumber) {
    data.docketNumber = latestDocket.docketNumber;
    data.latestDocketNumber = latestDocket.docketNumber;
  }
  if (latestDocket?.ewayBillNumber) {
    data.latestEwayBill = latestDocket.ewayBillNumber;
  }
  if (docketWithPod?.podDocumentUrl) {
    data.podDocumentUrl = docketWithPod.podDocumentUrl;
  }

  if (Object.keys(data).length === 0) return { updated: 0, skipped: null };

  const result = await client.inventoryItem.updateMany({
    where: { id: { in: itemIds } },
    data,
  });
  return { updated: result.count, skipped: null };
}
