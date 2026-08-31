"use client";

import { useState } from "react";
import { AllocateForm } from "@/components/warehouse/allocate-form";
import { AdvanceProvisioningModal } from "@/components/warehouse/advance-provisioning-modal";
import { BulkAdvanceModal } from "@/components/provisioning/bulk-advance-modal";
import { AlertCircle, ChevronDown, ChevronRight, ArrowRight, CheckSquare } from "lucide-react";
import { DataTableFilter, filterRows } from "@/components/shared/data-table-filter";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig } from "@/components/shared/column-filter";

interface AvailableItem {
  id: string;
  serialNumber: string;
  model: string;
  specs: string | null;
  status: string;
  employeeName: string | null;
  shippingAddress: string | null;
  city: string | null;
  state: string | null;
}

interface InventoryItem {
  id: string;
  serialNumber: string;
  model: string;
  imageType: string | null;
  stickerColour: string | null;
}

interface Asset {
  id: string;
  inventoryItemId: string | null;
  inventoryItem: InventoryItem | null;
}

interface Order {
  id: string;
  clientName: string;
  intermediary: string;
  totalQuantity: number;
  deliveryLocation: string;
  status: string;
  assets: Asset[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ORDER_PLACED: { label: "Order Placed", color: "bg-yellow-100 text-yellow-700" },
};

const STICKER_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  red:    { dot: "bg-red-500",    bg: "bg-red-100",    text: "text-red-700" },
  blue:   { dot: "bg-blue-500",   bg: "bg-blue-100",   text: "text-blue-700" },
  green:  { dot: "bg-green-500",  bg: "bg-green-100",  text: "text-green-700" },
  yellow: { dot: "bg-yellow-400", bg: "bg-yellow-100", text: "text-yellow-700" },
  orange: { dot: "bg-orange-500", bg: "bg-orange-100", text: "text-orange-700" },
  purple: { dot: "bg-purple-500", bg: "bg-purple-100", text: "text-purple-700" },
  pink:   { dot: "bg-pink-500",   bg: "bg-pink-100",   text: "text-pink-700" },
  silver: { dot: "bg-slate-300",  bg: "bg-slate-100",  text: "text-slate-700" },
  black:  { dot: "bg-gray-900",   bg: "bg-gray-800",   text: "text-white" },
  white:  { dot: "bg-gray-300",   bg: "bg-gray-100",   text: "text-gray-700" },
  grey:   { dot: "bg-gray-400",   bg: "bg-gray-100",   text: "text-gray-600" },
  gray:   { dot: "bg-gray-400",   bg: "bg-gray-100",   text: "text-gray-600" },
};

interface Props {
  orders: Order[];
  availableItems: AvailableItem[];
  canManage: boolean;
}

const PENDING_ALLOCATIONS_COLUMNS: ColumnFilterConfig<Order>[] = [
  { key: "clientName", getValue: r => r.clientName },
  { key: "deliveryLocation", getValue: r => r.deliveryLocation },
  { key: "imageType", getValue: r => r.assets.find(a => a.inventoryItem)?.inventoryItem?.imageType },
  { key: "stickerColour", getValue: r => r.assets.find(a => a.inventoryItem)?.inventoryItem?.stickerColour },
  { key: "totalQuantity", getValue: r => r.totalQuantity },
  { key: "serialNumber", getValue: r => r.assets.filter(a => a.inventoryItem).map(a => a.inventoryItem?.serialNumber).join(", ") },
  { key: "intermediary", getValue: r => r.intermediary },
  { key: "pending", getValue: r => r.assets.filter(a => a.inventoryItemId === null).length },
  { key: "status", getValue: r => r.status },
];

export function PendingAllocationsTable({ orders, availableItems, canManage }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [advanceOrderId, setAdvanceOrderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAdvanceIds, setBulkAdvanceIds] = useState<string[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const searchFiltered = filterRows(orders, searchQuery, [
    "clientName", "deliveryLocation", "intermediary", "status",
  ]).filter(order => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return order.assets.some(a => a.inventoryItem?.serialNumber?.toLowerCase().includes(q));
  });

  const { filteredRows: columnFiltered, distinctValues, filters, applyColumn, clearColumn } = useColumnFilters(PENDING_ALLOCATIONS_COLUMNS, searchFiltered);
  const filteredOrders = columnFiltered;

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)));
    }
  };

  const readyOrderIds = orders
    .filter(o => o.assets.every(a => a.inventoryItemId !== null))
    .map(o => o.id);

  const selectedReadyIds = [...selectedIds].filter(id => readyOrderIds.includes(id));

  if (orders.length === 0) {
    return (
      <div className="p-8 rounded-xl glass text-center text-muted-foreground">
        No orders pending allocation.
      </div>
    );
  }

  return (
    <>
      {/* Bulk action bar */}
      {canManage && selectedIds.size > 0 && (
        <div className="sticky top-16 z-30 -mt-4 mb-4 flex items-center justify-between gap-4 px-5 py-3 rounded-xl glass shadow-md border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckSquare className="size-4 text-primary" />
            {selectedIds.size} selected
            {selectedIds.size !== selectedReadyIds.length && (
              <span className="text-xs text-muted-foreground ml-1">
                ({selectedReadyIds.length} ready to advance)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setBulkAdvanceIds(selectedReadyIds)}
              disabled={selectedReadyIds.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Advance to Provisioning
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-muted transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl glass shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <DataTableFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search by client, location, serial no..." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
              <tr>
                {canManage && (
                  <th className="px-6 py-4 w-10">
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      checked={selectedIds.size === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-6 py-4 font-semibold w-10"></th>
                <ColumnFilterHeader
                  label="Client"
                  values={distinctValues.clientName ?? []}
                  selected={Array.from(filters["clientName"] ?? [])}
                  onApply={(v) => applyColumn("clientName", v)}
                />
                <ColumnFilterHeader
                  label="Location"
                  values={distinctValues.deliveryLocation ?? []}
                  selected={Array.from(filters["deliveryLocation"] ?? [])}
                  onApply={(v) => applyColumn("deliveryLocation", v)}
                />
                <ColumnFilterHeader
                  label="Image Type"
                  values={distinctValues.imageType ?? []}
                  selected={Array.from(filters["imageType"] ?? [])}
                  onApply={(v) => applyColumn("imageType", v)}
                />
                <ColumnFilterHeader
                  label="Sticker"
                  values={distinctValues.stickerColour ?? []}
                  selected={Array.from(filters["stickerColour"] ?? [])}
                  onApply={(v) => applyColumn("stickerColour", v)}
                />
                <ColumnFilterHeader
                  label="Units"
                  values={distinctValues.totalQuantity ?? []}
                  selected={Array.from(filters["totalQuantity"] ?? [])}
                  onApply={(v) => applyColumn("totalQuantity", v)}
                />
                <ColumnFilterHeader
                  label="Serial No."
                  values={distinctValues.serialNumber ?? []}
                  selected={Array.from(filters["serialNumber"] ?? [])}
                  onApply={(v) => applyColumn("serialNumber", v)}
                />
                <ColumnFilterHeader
                  label="Intermediary"
                  values={distinctValues.intermediary ?? []}
                  selected={Array.from(filters["intermediary"] ?? [])}
                  onApply={(v) => applyColumn("intermediary", v)}
                />
                <ColumnFilterHeader
                  label="Pending"
                  values={distinctValues.pending ?? []}
                  selected={Array.from(filters["pending"] ?? [])}
                  onApply={(v) => applyColumn("pending", v)}
                />
                <ColumnFilterHeader
                  label="Status"
                  values={distinctValues.status ?? []}
                  selected={Array.from(filters["status"] ?? [])}
                  onApply={(v) => applyColumn("status", v)}
                />
                {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 12 : 10} className="px-6 py-8 text-center text-muted-foreground">
                    No orders match the selected filters.
                  </td>
                </tr>
              )}
              {filteredOrders.map((order) => {
                const pendingAssetCount = order.assets.filter(
                  (a) => a.inventoryItemId === null
                ).length;
                const allocatedItem = order.assets.find(
                  (a) => a.inventoryItem
                )?.inventoryItem;
                const isExpanded = expandedId === order.id;

                return (
                  <tr key={order.id} id={`order-${order.id}`} className={`scroll-mt-20 ${selectedIds.has(order.id) ? "bg-primary/5" : ""}`}>
                    {canManage && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="accent-primary size-4"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleSelect(order.id)}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleRow(order.id)}
                        className="p-0.5 rounded hover:bg-muted transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-medium">{order.clientName}</td>
                    <td className="px-6 py-4 text-muted-foreground">{order.deliveryLocation}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {allocatedItem?.imageType || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {allocatedItem?.stickerColour ? (() => {
                        const s = STICKER_COLORS[allocatedItem.stickerColour.toLowerCase()];
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${s ? `${s.bg} ${s.text}` : "bg-muted text-muted-foreground"}`}>
                            <span className={`inline-block size-2 rounded-full ${s?.dot || "bg-muted-foreground"}`} />
                            {allocatedItem.stickerColour}
                          </span>
                        );
                      })() : (
                        <span className="text-xs font-mono text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{order.totalQuantity}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
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
                    <td className="px-6 py-4 text-muted-foreground">{order.intermediary}</td>
                    <td className="px-6 py-4">
                      {pendingAssetCount > 0 ? (
                        <span className="font-semibold text-yellow-600">{pendingAssetCount}</span>
                      ) : (
                        <span className="text-green-600 font-semibold">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_LABELS[order.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[order.status]?.label ?? order.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-6 py-4">
                        {pendingAssetCount > 0 ? (
                          <button
                            onClick={() => toggleRow(order.id)}
                            className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                          >
                            {isExpanded ? "Close" : "Allocate"}
                          </button>
                        ) : (
                          <button
                            onClick={() => setAdvanceOrderId(order.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-800 transition-colors"
                          >
                            Advance to Provisioning
                            <ArrowRight className="size-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded rows — rendered below the table */}
        {orders.map((order) => {
          if (expandedId !== order.id) return null;
          const pendingAssetCount = order.assets.filter(
            (a) => a.inventoryItemId === null
          ).length;

          if (pendingAssetCount > 0) {
            return (
              <div key={`expand-${order.id}`} className="border-t px-6 py-5 bg-muted/10">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="size-4 text-yellow-500" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {pendingAssetCount} laptop(s) still need to be assigned from inventory.
                  </p>
                </div>
                <AllocateForm
                  orderId={order.id}
                  requiredCount={pendingAssetCount}
                  availableItems={availableItems}
                />
              </div>
            );
          }

          return (
            <div key={`expand-${order.id}`} className="border-t px-6 py-5 bg-muted/10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-green-600 flex items-center gap-2">
                  All assets allocated and ready for provisioning.
                </p>
                {canManage && (
                  <button
                    onClick={() => setAdvanceOrderId(order.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                  >
                    Advance to Provisioning
                    <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <AdvanceProvisioningModal
          orderId={advanceOrderId ?? ""}
          open={advanceOrderId !== null}
          onClose={() => setAdvanceOrderId(null)}
        />
      </div>

      {bulkAdvanceIds && (
        <BulkAdvanceModal
          orderIds={bulkAdvanceIds}
          onClose={() => setBulkAdvanceIds(null)}
        />
      )}
    </>
  );
}
