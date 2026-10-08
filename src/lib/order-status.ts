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
