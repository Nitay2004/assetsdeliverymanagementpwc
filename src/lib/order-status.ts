import type { OrderStatus } from "@prisma/client";

// Full order pipeline statuses. Every module datatable uses this list so that
// an order never disappears from a datatable once it has entered the pipeline.
export const ORDER_PIPELINE_STATUSES: OrderStatus[] = [
  "ALLOCATED",
  "IN_PROVISIONING",
  "DC_REQUESTED",
  "DC_GENERATED",
  "DOCKET_REQUESTED",
  "DOCKET_ASSIGNED",
  "PACKED_AND_LABELLED",
  "EWAY_BILL_REQUESTED",
  "EWAY_BILL_GENERATED",
  "DISPATCHED",
  "DELIVERED",
  "RTO",
  "RTO_DC_REQUESTED",
  "RTO_DC_GENERATED",
  "RTO_EWAY_BILL_REQUESTED",
  "RTO_EWAY_BILL_GENERATED",
  "RTO_IN_TRANSIT",
  "RTO_DELIVERED_TO_WAREHOUSE",
  "DELIVERY_CONFIRMED",
  "INVOICED",
  "WARRANTY_UPDATED",
  "CANCELLED",
];

// Forward finance sub-tab status sets. Both sub-tabs are sticky: once an order
// has shown in a sub-tab it never leaves it, so advancing stages (DC generated
// → e-way requested → e-way generated → onward) never empties a table.
//
// DC sub-tab: the full pipeline — a row stays visible from its first entry all
// the way through dispatch, delivery, RTO and everything after. Orders that
// reach the e-way stage keep showing here as well (the E-Way sub-tab is a
// focused overlay of the same rows, not a move).
export const FORWARD_DC_STATUSES: OrderStatus[] = ORDER_PIPELINE_STATUSES;

// E-Way sub-tab: e-way work onwards. Once an order enters here it stays —
// generated, packed, dispatched, delivered rows are all kept visible.
export const FORWARD_EWAY_STATUSES: OrderStatus[] = [
  "PACKED_AND_LABELLED",
  "EWAY_BILL_REQUESTED",
  "EWAY_BILL_GENERATED",
  "DISPATCHED",
  "DELIVERED",
  "RTO_EWAY_BILL_REQUESTED",
  "RTO_EWAY_BILL_GENERATED",
  "RTO_IN_TRANSIT",
  "RTO_DELIVERED_TO_WAREHOUSE",
  "DELIVERY_CONFIRMED",
  "INVOICED",
  "WARRANTY_UPDATED",
  "CANCELLED",
];

// Statuses that still need provisioning work.
export const ACTIVE_PROVISIONING_STATUSES: OrderStatus[] = ["ALLOCATED", "IN_PROVISIONING"];

// Statuses where the order has been handed over to logistics.
export const HANDED_OVER_STATUSES: OrderStatus[] = ["DC_REQUESTED", "DOCKET_REQUESTED", "DOCKET_ASSIGNED"];

// ─── Transition policy ───────────────────────────────────────────────────────
//
// Every server action that changes Order.status must go through this module so
// that a caller cannot jump an order straight to DELIVERED/CANCELLED/RTO_* and
// bypass the lifecycle (an audit finding). The UI may still render arbitrary
// labels, but the server only accepts transitions declared here.

export const ORDER_STATUSES: OrderStatus[] = ["ORDER_PLACED", ...ORDER_PIPELINE_STATUSES];

const ORDER_STATUS_SET = new Set<string>(ORDER_STATUSES);

export function isValidOrderStatus(status: string): status is OrderStatus {
  return ORDER_STATUS_SET.has(status);
}

// Forward lifecycle plus the few legitimate backwards/side moves the existing
// UI relies on: provisioning can send an order back to ALLOCATED, logistics can
// re-request a DC, and delivery can be confirmed after it is marked delivered.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ORDER_PLACED: ["ALLOCATED", "CANCELLED"],
  ALLOCATED: ["IN_PROVISIONING", "CANCELLED"],
  IN_PROVISIONING: ["DC_REQUESTED", "ALLOCATED", "CANCELLED"],
  DC_REQUESTED: ["DC_GENERATED", "CANCELLED"],
  DC_GENERATED: ["DOCKET_REQUESTED", "CANCELLED"],
  DOCKET_REQUESTED: ["DOCKET_ASSIGNED", "CANCELLED"],
  DOCKET_ASSIGNED: ["DC_REQUESTED", "EWAY_BILL_REQUESTED", "CANCELLED"],
  EWAY_BILL_REQUESTED: ["EWAY_BILL_GENERATED", "CANCELLED"],
  EWAY_BILL_GENERATED: ["PACKED_AND_LABELLED", "CANCELLED"],
  PACKED_AND_LABELLED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED", "RTO", "CANCELLED"],
  DELIVERED: ["DELIVERY_CONFIRMED", "INVOICED"],
  DELIVERY_CONFIRMED: ["INVOICED", "DELIVERED"],
  INVOICED: ["WARRANTY_UPDATED"],
  WARRANTY_UPDATED: [],
  RTO: ["RTO_DC_REQUESTED"],
  RTO_DC_REQUESTED: ["RTO_DC_GENERATED", "CANCELLED"],
  RTO_DC_GENERATED: ["RTO_EWAY_BILL_REQUESTED", "CANCELLED"],
  RTO_EWAY_BILL_REQUESTED: ["RTO_EWAY_BILL_GENERATED", "CANCELLED"],
  RTO_EWAY_BILL_GENERATED: ["RTO_IN_TRANSIT", "CANCELLED"],
  RTO_IN_TRANSIT: ["RTO_DELIVERED_TO_WAREHOUSE", "CANCELLED"],
  RTO_DELIVERED_TO_WAREHOUSE: [],
  CANCELLED: [],
};

/**
 * Returns a human-readable error string when the transition is not allowed,
 * or null when it is. A no-op transition (same status) is always allowed.
 */
export function orderTransitionError(from: string, to: string): string | null {
  if (!isValidOrderStatus(to)) {
    return `Unknown order status "${to}".`;
  }
  if (from === to) return null;
  if (!isValidOrderStatus(from)) {
    return `Cannot transition from unknown status "${from}".`;
  }
  const allowed = ORDER_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    return `Cannot change order status from ${from} to ${to}.`;
  }
  return null;
}
