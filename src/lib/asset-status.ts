import type { OrderStatus } from "@prisma/client";

// Asset.status is a legacy free-form string column, not a Prisma enum. These
// are the only values the app writes; keeping them in one place stops the
// materializer, warehouse allocation and release paths from drifting apart.
export const ASSET_STATUS = {
  PENDING: "pending",
  ALLOCATED: "allocated",
  QC_PASS: "qc_pass",
  OS_INSTALLED: "os_installed",
  RELEASED: "released",
} as const;

export type AssetStatus = (typeof ASSET_STATUS)[keyof typeof ASSET_STATUS];

// An order in one of these states no longer owns its assets. The Asset rows
// stay for history, but must be "released" so the partial unique index on
// assets.inventory_item_id frees the physical item for a future allocation.
export const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  "DELIVERED",
  "DELIVERY_CONFIRMED",
  "INVOICED",
  "WARRANTY_UPDATED",
  "RTO_DELIVERED_TO_WAREHOUSE",
  "CANCELLED",
];

const TERMINAL_ORDER_STATUS_SET: ReadonlySet<string> = new Set(TERMINAL_ORDER_STATUSES);

export function isTerminalOrderStatus(status: string): boolean {
  return TERMINAL_ORDER_STATUS_SET.has(status);
}

/**
 * Status for an Asset row created together with an order.
 *
 * The materializer used to create every backfilled row as "allocated", even for
 * orders it had already marked DELIVERED. That contradicted the release path
 * (same order, "released") and left a live-looking allocation on a unit that
 * was actually out with a user.
 */
export function assetStatusForOrderStatus(status: string): AssetStatus {
  return isTerminalOrderStatus(status) ? ASSET_STATUS.RELEASED : ASSET_STATUS.ALLOCATED;
}
