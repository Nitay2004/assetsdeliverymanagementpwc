"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Loader2, Laptop } from "lucide-react";
import { getOrdersByStatus, getInventoryItemsByTrackingKeywords } from "@/app/actions/dashboard";
import type { OrderStatus } from "@prisma/client";
import type { TableInventoryDeliveryData } from "@/app/actions/dashboard";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  statuses: OrderStatus[];
  inventoryTrackingKeywords?: string[];
}

const STATUS_LABELS: Record<string, string> = {
  ORDER_PLACED: "Order Placed",
  ALLOCATED: "Allocated",
  IN_PROVISIONING: "In Provisioning",
  DC_GENERATED: "DC Generated",
  PACKED_AND_LABELLED: "Packed & Labelled",
  DOCKET_ASSIGNED: "Docket Assigned",
  EWAY_BILL_REQUESTED: "E-Way Bill Requested",
  EWAY_BILL_GENERATED: "E-Way Bill Generated",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  DELIVERY_CONFIRMED: "Delivery Confirmed",
  INVOICED: "Invoiced",
  RTO: "RTO",
  RTO_DC_REQUESTED: "RTO DC Requested",
  RTO_DC_GENERATED: "RTO DC Generated",
  RTO_EWAY_BILL_REQUESTED: "RTO E-Way Bill Requested",
  RTO_EWAY_BILL_GENERATED: "RTO E-Way Bill Generated",
  RTO_IN_TRANSIT: "RTO In Transit",
  RTO_DELIVERED_TO_WAREHOUSE: "RTO Delivered to Warehouse",
  WARRANTY_UPDATED: "Warranty Updated",
};

const STATUS_COLORS: Record<string, string> = {
  ORDER_PLACED: "bg-yellow-100 text-yellow-700",
  ALLOCATED: "bg-blue-100 text-blue-700",
  IN_PROVISIONING: "bg-purple-100 text-purple-700",
  DC_GENERATED: "bg-indigo-100 text-indigo-700",
  PACKED_AND_LABELLED: "bg-cyan-100 text-cyan-700",
  DOCKET_ASSIGNED: "bg-blue-100 text-blue-700",
  EWAY_BILL_REQUESTED: "bg-yellow-100 text-yellow-700",
  EWAY_BILL_GENERATED: "bg-orange-100 text-orange-700",
  DISPATCHED: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  DELIVERY_CONFIRMED: "bg-green-200 text-green-800",
  RTO: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 50;

export function OrderTableModal({ open, onClose, title, icon, iconBg, statuses, inventoryTrackingKeywords }: Props) {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof getOrdersByStatus>>["orders"]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<TableInventoryDeliveryData[]>([]);
  const [invTotal, setInvTotal] = useState(0);
  const [invPage, setInvPage] = useState(1);
  const [invLoading, setInvLoading] = useState(false);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await getOrdersByStatus(statuses, p, PAGE_SIZE);
      setOrders(data.orders);
      setTotal(data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [statuses]);

  const fetchInventoryPage = useCallback(async (p: number) => {
    if (!inventoryTrackingKeywords || inventoryTrackingKeywords.length === 0) return;
    setInvLoading(true);
    try {
      const data = await getInventoryItemsByTrackingKeywords(inventoryTrackingKeywords, p, PAGE_SIZE);
      setInventoryItems(data.items);
      setInvTotal(data.total);
      setInvPage(p);
    } finally {
      setInvLoading(false);
    }
  }, [inventoryTrackingKeywords]);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchPage(1);
      if (inventoryTrackingKeywords && inventoryTrackingKeywords.length > 0) {
        setInvPage(1);
        fetchInventoryPage(1);
      }
    }
  }, [open, fetchPage, fetchInventoryPage, inventoryTrackingKeywords]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const invTotalPages = Math.max(1, Math.ceil(invTotal / PAGE_SIZE));

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-xl border w-full max-w-5xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${iconBg}`}>
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading..." : inventoryTrackingKeywords ? `${total} orders, ${invTotal} assets` : `${total} order${total !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-auto p-6 min-h-[200px] space-y-6">
          {/* Orders Section */}
          <div>
            {!inventoryTrackingKeywords && (
              <p className="text-sm text-muted-foreground mb-2">
                {loading ? "Loading..." : `${total} order${total !== 1 ? "s" : ""}`}
              </p>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 text-muted-foreground animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              !inventoryTrackingKeywords && (
                <p className="text-sm text-muted-foreground text-center py-8">No orders found.</p>
              )
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold text-center">Units</th>
                    <th className="px-4 py-3 font-semibold">Serial No.</th>
                    <th className="px-4 py-3 font-semibold">Dockets</th>
                    <th className="px-4 py-3 font-semibold">DC No</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-medium">{order.clientName}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{order.deliveryLocation}</td>
                      <td className="px-4 py-3 text-center">{order.totalQuantity}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {order.assets.filter(a => a.inventoryItem).map(a => (
                            <span key={a.id} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-mono">
                              {a.inventoryItem!.serialNumber}
                            </span>
                          ))}
                          {order.assets.filter(a => a.inventoryItem).length === 0 && (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {order.dockets.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {order.dockets.map((d, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-gray-50 text-gray-700 text-xs font-mono">
                                {d.docketNumber}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{order.dcNumber ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Assigned Assets Section */}
          {inventoryTrackingKeywords && inventoryTrackingKeywords.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 pt-4 border-t">
                <Laptop className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Assigned Assets ({invTotal} laptop{invTotal !== 1 ? "s" : ""})
                </h3>
              </div>
              {invLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 text-muted-foreground animate-spin" />
                </div>
              ) : inventoryItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No matching assigned assets found.</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Employee</th>
                      <th className="px-4 py-3 font-semibold">Model</th>
                      <th className="px-4 py-3 font-semibold">Serial No.</th>
                      <th className="px-4 py-3 font-semibold">Tracking Status</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">DC No</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inventoryItems.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-medium">{item.employeeName || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.model}</td>
                        <td className="px-4 py-3 font-mono text-xs">{item.serialNumber}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            {item.trackingStatus || item.trackingSubStatus || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {[item.city, item.state].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{item.dcNumber || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {inventoryTrackingKeywords ? (
          <div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
            <div className="flex items-center gap-4">
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Orders:</span>
                  <button
                    onClick={() => fetchPage(page - 1)}
                    disabled={page <= 1 || loading}
                    className="p-1.5 rounded-md border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
                  <button
                    onClick={() => fetchPage(page + 1)}
                    disabled={page >= totalPages || loading}
                    className="p-1.5 rounded-md border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}
              {invTotalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Assets:</span>
                  <button
                    onClick={() => fetchInventoryPage(invPage - 1)}
                    disabled={invPage <= 1 || invLoading}
                    className="p-1.5 rounded-md border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="text-xs text-muted-foreground">{invPage}/{invTotalPages}</span>
                  <button
                    onClick={() => fetchInventoryPage(invPage + 1)}
                    disabled={invPage >= invTotalPages || invLoading}
                    className="p-1.5 rounded-md border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchPage(page - 1)}
                  disabled={page <= 1 || loading}
                  className="p-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => fetchPage(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="p-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>,
    document.body
  );
}
