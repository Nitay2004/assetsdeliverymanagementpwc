"use client";

import { useState } from "react";
import { AllocateForm } from "@/components/warehouse/allocate-form";
import { AdvanceProvisioningModal } from "@/components/warehouse/advance-provisioning-modal";
import { AlertCircle, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";

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

export function PendingAllocationsTable({ orders, availableItems, canManage }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [advanceOrderId, setAdvanceOrderId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (orders.length === 0) {
    return (
      <div className="p-8 rounded-xl glass text-center text-muted-foreground">
        No orders pending allocation.
      </div>
    );
  }

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold w-10"></th>
              <th className="px-6 py-4 font-semibold">Client</th>
              <th className="px-6 py-4 font-semibold">Location</th>
              <th className="px-6 py-4 font-semibold">Image Type</th>
              <th className="px-6 py-4 font-semibold">Sticker</th>
              <th className="px-6 py-4 font-semibold">Units</th>
              <th className="px-6 py-4 font-semibold">Intermediary</th>
              <th className="px-6 py-4 font-semibold">Pending</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => {
              const pendingAssetCount = order.assets.filter(
                (a) => a.inventoryItemId === null
              ).length;
              const allocatedItem = order.assets.find(
                (a) => a.inventoryItem
              )?.inventoryItem;
              const isExpanded = expandedId === order.id;

              return (
                <tr key={order.id} id={`order-${order.id}`} className="scroll-mt-20">
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
  );
}
