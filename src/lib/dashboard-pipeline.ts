import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DELIVERY_EVIDENCE_OR, UNSYNCED_DELIVERED_INVENTORY_WHERE } from "@/lib/inventory-order-materialize";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/order-status";

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the dashboard's forward-flow card numbers.
//
// Bulk Excel imports create InventoryItem rows only. The materializer turns the
// delivered ones into Order/Asset/Docket records, but it is deliberately capped
// per run, so a backlog can exist between two syncs. Counting Orders alone made
// the cards lag behind reality ("Delivered 6124" while ~9.4k assets were out);
// counting raw inventory alone double-counted whatever was already materialised.
//
// The rule here is: each physical unit is counted exactly once —
//   • if it has an Asset link, it is represented by its Order;
//   • otherwise it is counted from Inventory, in the stage its own evidence
//     proves (delivered / in transit / RTO).
// The stage predicates below are mutually exclusive for the three fallback
// buckets, so a unit can never inflate two cards.
// ─────────────────────────────────────────────────────────────────────────────

export const DASHBOARD_DELIVERED_KEYWORDS = ["deliver"];
export const DASHBOARD_IN_TRANSIT_KEYWORDS = ["in transit", "dispatched", "shipped"];
export const DASHBOARD_RTO_KEYWORDS = ["rto", "return to origin"];

const NO_ASSET_LINK: Prisma.InventoryItemWhereInput = { assets: { none: {} } };

// Delivery evidence wins over transit/RTO text: a row that carries a delivery
// date or a deployed status is delivered, whatever its tracking column says.
const NOT_DELIVERED: Prisma.InventoryItemWhereInput = { NOT: { OR: DELIVERY_EVIDENCE_OR } };

function trackingMatches(keywords: string[]): Prisma.InventoryItemWhereInput {
  return {
    OR: keywords.flatMap(keyword => [
      { trackingStatus: { contains: keyword, mode: "insensitive" as const } },
      { trackingSubStatus: { contains: keyword, mode: "insensitive" as const } },
      { latestTrackingStatus: { contains: keyword, mode: "insensitive" as const } },
    ]),
  };
}

export const UNSYNCED_DELIVERED_WHERE = UNSYNCED_DELIVERED_INVENTORY_WHERE;

export const UNSYNCED_IN_TRANSIT_WHERE: Prisma.InventoryItemWhereInput = {
  AND: [
    NO_ASSET_LINK,
    NOT_DELIVERED,
    {
      NOT: trackingMatches(DASHBOARD_RTO_KEYWORDS),
    },
    trackingMatches(DASHBOARD_IN_TRANSIT_KEYWORDS),
  ],
};

export const UNSYNCED_RTO_WHERE: Prisma.InventoryItemWhereInput = {
  AND: [NO_ASSET_LINK, NOT_DELIVERED, trackingMatches(DASHBOARD_RTO_KEYWORDS)],
};

export interface ForwardPipelineCounts {
  inWarehouseAllocation: number;
  inProvisioning: number;
  packedAndLabelled: number;
  inTransit: number;
  delivered: number;
  rto: number;
  /** Units still waiting to be turned into orders — shown next to the sync button. */
  pendingMaterialization: number;
  pipelineData: { status: string; count: number; color: string }[];
  totalOrders: number;
  /** Raw per-status Order counts, used by the module quick-links. */
  statusCounts: Record<OrderStatus, number>;
}

/**
 * Computes every forward-flow card from one consistent snapshot.
 * `createdAt` is the optional DateRangePicker filter and is applied to both the
 * Order and InventoryItem queries so the two sources stay comparable.
 */
export async function getForwardPipelineCounts(createdAt?: Record<string, Date>): Promise<ForwardPipelineCounts> {
  const orderWhere: Prisma.OrderWhereInput = createdAt ? { createdAt } : {};
  const inventoryScope: Prisma.InventoryItemWhereInput = createdAt ? { createdAt } : {};

  const [orderStatuses, unsyncedDelivered, unsyncedInTransit, unsyncedRto] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: orderWhere,
      _count: { _all: true },
    }),
    prisma.inventoryItem.count({
      where: { AND: [inventoryScope, UNSYNCED_DELIVERED_WHERE] },
    }),
    prisma.inventoryItem.count({
      where: { AND: [inventoryScope, UNSYNCED_IN_TRANSIT_WHERE] },
    }),
    prisma.inventoryItem.count({
      where: { AND: [inventoryScope, UNSYNCED_RTO_WHERE] },
    }),
  ]);

  const orderCounts = new Map(orderStatuses.map(row => [row.status, row._count._all]));
  const count = (status: OrderStatus) => orderCounts.get(status) ?? 0;
  const totalOrders = orderStatuses.reduce((sum, row) => sum + row._count._all, 0);

  const pipelineData = Array.from(orderCounts.entries())
    .map(([status, value]) => ({
      status: ORDER_STATUS_LABELS[status] ?? status,
      count: value,
      color: ORDER_STATUS_COLORS[status] ?? "#94a3b8",
    }))
    .sort((a, b) => b.count - a.count);

  return {
    inWarehouseAllocation: count("ORDER_PLACED"),
    inProvisioning: count("ALLOCATED") + count("IN_PROVISIONING"),
    packedAndLabelled: count("PACKED_AND_LABELLED"),
    inTransit: count("DISPATCHED") + unsyncedInTransit,
    delivered: count("DELIVERED") + count("DELIVERY_CONFIRMED") + unsyncedDelivered,
    rto: (
      ["RTO", "RTO_DC_REQUESTED", "RTO_DC_GENERATED", "RTO_EWAY_BILL_REQUESTED",
       "RTO_EWAY_BILL_GENERATED", "RTO_IN_TRANSIT", "RTO_DELIVERED_TO_WAREHOUSE"] as const
    ).reduce((sum, status) => sum + count(status), 0) + unsyncedRto,
    pendingMaterialization: unsyncedDelivered,
    pipelineData,
    totalOrders,
    statusCounts: Object.fromEntries(
      (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map(status => [status, count(status)])
    ) as Record<OrderStatus, number>,
  };
}
