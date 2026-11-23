import type { OrderStatus } from "@prisma/client";

// Full order pipeline statuses: the whole lifecycle an order can be in once it
// has left ORDER_PLACED. Individual modules narrow this to their own window with
// the FORWARD_*_STATUSES sets below.
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

// ─── Forward stage ownership ─────────────────────────────────────────────────
//
// Forward visibility is cumulative ("sticky"): a module lists an order from the
// stage that module first acts on and keeps listing it through every later
// stage — including dispatch, delivery, RTO and closure. Nothing is dropped
// when the next team takes over, so a delivered order is visible in Warehouse,
// Provisioning, Finance and Logistics at the same time.
//
// First stage per module:
//   Warehouse     ALLOCATED        the warehouse allocates the stock
//   Provisioning  ALLOCATED        an engineer provisions the allocated units
//   Finance       IN_PROVISIONING  finance can raise the DC from here
//   Logistics     DC_REQUESTED     provisioning hands the order over
//
// CANCELLED stays in every window: an order that was already visible keeps
// showing after it is cancelled instead of vanishing from the audit trail.
//
// The lists are written in lifecycle order rather than sliced from
// ORDER_PIPELINE_STATUSES (that list is grouped by owning team, so e.g. packing
// appears before the e-way stages there). Keeping them explicit means
// re-ordering the pipeline array can never silently widen or narrow a window.

// Tail shared by every window: dispatch, delivery, RTO and closure.
const LATE_STAGE_STATUSES: OrderStatus[] = [
  "DISPATCHED",
  "DELIVERED",
  "DELIVERY_CONFIRMED",
  "INVOICED",
  "WARRANTY_UPDATED",
  "RTO",
  "RTO_DC_REQUESTED",
  "RTO_DC_GENERATED",
  "RTO_EWAY_BILL_REQUESTED",
  "RTO_EWAY_BILL_GENERATED",
  "RTO_IN_TRANSIT",
  "RTO_DELIVERED_TO_WAREHOUSE",
  "CANCELLED",
];

// Warehouse: the order exists from allocation onwards, so this is the whole
// pipeline. Rows never leave the allocated-assets table.
export const FORWARD_WAREHOUSE_STATUSES: OrderStatus[] = ORDER_PIPELINE_STATUSES;

// Provisioning: same window — an allocated order is already provisioning work,
// and it stays listed (active → handed over → further stages) after handover.
export const FORWARD_PROVISIONING_STATUSES: OrderStatus[] = ORDER_PIPELINE_STATUSES;

// Logistics: the order enters when provisioning requests the DC (that is the
// handover) and stays through docket, packing, dispatch, delivery and RTO.
export const FORWARD_LOGISTICS_STATUSES: OrderStatus[] = [
  "DC_REQUESTED",
  "DC_GENERATED",
  "DOCKET_REQUESTED",
  "DOCKET_ASSIGNED",
  "EWAY_BILL_REQUESTED",
  "EWAY_BILL_GENERATED",
  "PACKED_AND_LABELLED",
  ...LATE_STAGE_STATUSES,
];

// Finance: finance can raise the DC while the order is still in provisioning,
// so its window opens one stage earlier than Logistics and then runs on.
export const FORWARD_FINANCE_STATUSES: OrderStatus[] = [
  "IN_PROVISIONING",
  ...FORWARD_LOGISTICS_STATUSES,
];

// Finance DC sub-tab. Sticky: the row stays visible from its first entry all
// the way through dispatch, delivery, RTO and everything after. Orders that
// reach the e-way stage keep showing here too — the E-Way sub-tab is a focused
// overlay of the same rows, not a move.
export const FORWARD_DC_STATUSES: OrderStatus[] = FORWARD_FINANCE_STATUSES;

// Finance E-Way sub-tab: e-way work onwards. Once an order enters here
// (logistics requested the bill) it stays through packing, dispatch, delivery,
// RTO and closure.
export const FORWARD_EWAY_STATUSES: OrderStatus[] = [
  "EWAY_BILL_REQUESTED",
  "EWAY_BILL_GENERATED",
  "PACKED_AND_LABELLED",
  ...LATE_STAGE_STATUSES,
];

// Statuses that still need provisioning work.
export const ACTIVE_PROVISIONING_STATUSES: OrderStatus[] = ["ALLOCATED", "IN_PROVISIONING"];

// Statuses where the order has been handed over to logistics.
export const HANDED_OVER_STATUSES: OrderStatus[] = ["DC_REQUESTED", "DOCKET_REQUESTED", "DOCKET_ASSIGNED"];

// Statuses in which a shipment is still in the warehouse and its docket details
// (docket number, courier, e-way bill, POD) may still be corrected. Once the
// parcel is dispatched the docket is tied to a physical consignment, so editing
// it afterwards would desync the record from what actually left the building.
export const DOCKET_EDITABLE_STATUSES: OrderStatus[] = [
  "IN_PROVISIONING",
  "DC_REQUESTED",
  "DC_GENERATED",
  "DOCKET_REQUESTED",
  "DOCKET_ASSIGNED",
  "PACKED_AND_LABELLED",
  "EWAY_BILL_REQUESTED",
  "EWAY_BILL_GENERATED",
];

// ─── Transition policy ───────────────────────────────────────────────────────
//
// Every server action that changes Order.status must go through this module so
// that a caller cannot jump an order straight to DELIVERED/CANCELLED/RTO_* and
// bypass the lifecycle (an audit finding). The UI may still render arbitrary
// labels, but the server only accepts transitions declared here.

export const ORDER_STATUSES: OrderStatus[] = ["ORDER_PLACED", ...ORDER_PIPELINE_STATUSES];

// Single source of truth for how every status is labelled and coloured. The
// dashboard pipeline chart, stat-card modals and activity feed all read these,
// so adding a new OrderStatus can never silently disappear from a view.
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  ORDER_PLACED: "Order Placed",
  ALLOCATED: "Allocated",
  IN_PROVISIONING: "Provisioning",
  DOCKET_REQUESTED: "Docket Requested",
  DOCKET_ASSIGNED: "Docketed",
  DC_REQUESTED: "DC Requested",
  DC_GENERATED: "DC Generated",
  PACKED_AND_LABELLED: "Packed & Labelled",
  EWAY_BILL_REQUESTED: "E-Way Req",
  EWAY_BILL_GENERATED: "E-Way Gen",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  DELIVERY_CONFIRMED: "Confirmed",
  INVOICED: "Invoiced",
  WARRANTY_UPDATED: "Warranty",
  RTO: "RTO",
  RTO_DC_REQUESTED: "RTO DC Req",
  RTO_DC_GENERATED: "RTO DC Gen",
  RTO_EWAY_BILL_REQUESTED: "RTO E-Way Req",
  RTO_EWAY_BILL_GENERATED: "RTO E-Way Gen",
  RTO_IN_TRANSIT: "RTO In Transit",
  RTO_DELIVERED_TO_WAREHOUSE: "RTO At Warehouse",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  ORDER_PLACED: "#eab308",
  ALLOCATED: "#3b82f6",
  IN_PROVISIONING: "#a855f7",
  DOCKET_REQUESTED: "#f59e0b",
  DOCKET_ASSIGNED: "#06b6d4",
  DC_REQUESTED: "#818cf8",
  DC_GENERATED: "#6366f1",
  PACKED_AND_LABELLED: "#8b5cf6",
  EWAY_BILL_REQUESTED: "#14b8a6",
  EWAY_BILL_GENERATED: "#10b981",
  DISPATCHED: "#f97316",
  DELIVERED: "#22c55e",
  DELIVERY_CONFIRMED: "#16a34a",
  INVOICED: "#0ea5e9",
  WARRANTY_UPDATED: "#7c3aed",
  RTO: "#ef4444",
  RTO_DC_REQUESTED: "#f43f5e",
  RTO_DC_GENERATED: "#e11d48",
  RTO_EWAY_BILL_REQUESTED: "#ec4899",
  RTO_EWAY_BILL_GENERATED: "#db2777",
  RTO_IN_TRANSIT: "#be123c",
  RTO_DELIVERED_TO_WAREHOUSE: "#9f1239",
  CANCELLED: "#6b7280",
};

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
