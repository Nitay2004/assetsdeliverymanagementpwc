"use client";

import { useState, useCallback, useEffect } from "react";
import { Edit3, Undo2, User, MapPin, Loader2, CheckSquare } from "lucide-react";
import { updateAssetStatus, removeFromProvisioning, bulkMarkOsInstalled, handoverToLogistics, getProvisioningDropdowns, addProvisioningDropdownOption, deleteProvisioningDropdownOption } from "@/app/actions/provisioning";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ProvisioningEditModal } from "./provisioning-edit-modal";
import { ScrollToItem } from "@/components/shared/scroll-to-item";
import { DataTableFilter, filterRows, UrlDataTableFilter } from "@/components/shared/data-table-filter";

const ASSET_STATUS_STYLES: Record<string, string> = {
  pending:     "bg-yellow-100 text-yellow-700",
  allocated:   "bg-blue-100 text-blue-700",
  os_installed:"bg-green-100 text-green-700",
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

interface InventoryItem {
  id: string;
  serialNumber: string;
  model: string;
  imageType: string | null;
  stickerColour: string | null;
  trackingStatus: string | null;
}

interface Asset {
  id: string;
  status: string;
  inventoryItem: InventoryItem | null;
}

interface Order {
  id: string;
  clientName: string;
  deliveryLocation: string;
  totalQuantity: number;
  status: string;
  engineerName: string | null;
  warehouseLocation: string | null;
  provisioningLocation: string | null;
  assets: Asset[];
}

interface Props {
  orders: Order[];
  canManage: boolean;
  engineers: string[];
  selectedId?: string;
}

export function ProvisioningTable({ orders, canManage, engineers, selectedId }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [editDefaults, setEditDefaults] = useState<{ warehouseLocation: string; provisioningLocation: string; engineerName: string } | null>(null);

  const rows = orders.flatMap(order =>
    order.assets.map(asset => ({ order, asset }))
  );

  const allRows = rows;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map(r => r.asset.id)));
    }
  };

  const uniqueOrderIdsFromSelection = [...new Set(
    rows.filter(r => selectedIds.has(r.asset.id)).map(r => r.order.id)
  )];

  async function handleBulkOsInstall() {
    const assetIds = rows
      .filter(r => selectedIds.has(r.asset.id) && r.asset.status === "allocated")
      .map(r => r.asset.id);
    if (assetIds.length === 0) {
      toast({ title: "Nothing to update", description: "No allocated assets selected.", variant: "error" });
      return;
    }
    try {
      await bulkMarkOsInstalled(assetIds);
      toast({ title: "Updated", description: `${assetIds.length} asset(s) marked OS Installed.`, variant: "success" });
      setSelectedIds(new Set());
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  async function handleHandoverToLogistics(orderIds?: string[]) {
    const ids = orderIds ?? uniqueOrderIdsFromSelection;
    if (ids.length === 0) {
      toast({ title: "Nothing to handover", description: "No orders selected.", variant: "error" });
      return;
    }
    try {
      await handoverToLogistics(ids);
      toast({ title: "Handed Over", description: `${ids.length} order(s) sent to logistics.`, variant: "success" });
      setSelectedIds(new Set());
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  async function handleStatusUpdate(assetId: string, newStatus: string) {
    try {
      await updateAssetStatus(assetId, newStatus);
      toast({ title: "Updated", description: "Asset status changed.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  async function handleRemove(orderId: string) {
    try {
      await removeFromProvisioning(orderId);
      toast({ title: "Removed", description: "Order returned to warehouse.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  function openEdit(order: Order) {
    setEditDefaults({
      warehouseLocation: order.warehouseLocation ?? "",
      provisioningLocation: order.provisioningLocation ?? "",
      engineerName: order.engineerName ?? "",
    });
    setEditOrderId(order.id);
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 rounded-xl glass text-center text-muted-foreground">
        No assets in provisioning.
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
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkOsInstall}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              Mark OS Installed
            </button>
            <button
              onClick={() => handleHandoverToLogistics()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Handed over to Logistics
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
          <UrlDataTableFilter placeholder="Search by client, engineer, serial no, model, location..." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
              <tr>
                {canManage && (
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      checked={selectedIds.size === rows.length && rows.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-4 py-4 font-semibold">Serial No</th>
                <th className="px-4 py-4 font-semibold">Model</th>
                <th className="px-4 py-4 font-semibold">Image Type</th>
                <th className="px-4 py-4 font-semibold">Sticker</th>
                <th className="px-4 py-4 font-semibold">Client</th>
                <th className="px-4 py-4 font-semibold">Engineer</th>
                <th className="px-4 py-4 font-semibold">WH</th>
                <th className="px-4 py-4 font-semibold">Prov Loc</th>
                <th className="px-4 py-4 font-semibold">Asset Status</th>
                {canManage && <th className="px-4 py-4 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              <ScrollToItem selectedId={selectedId} prefix="prov" />
              {orders.flatMap(order =>
                order.assets.map((asset, idx) => {
                const inv = asset.inventoryItem;
                const sColor = inv?.stickerColour
                  ? STICKER_COLORS[inv.stickerColour.toLowerCase()]
                  : null;
                const nextStatus = asset.status === "allocated"
                  ? { label: "Mark OS Installed", status: "os_installed" }
                  : null;

                return (
                  <tr key={asset.id} id={idx === 0 ? `prov-${order.id}` : undefined} className={`hover:bg-muted/10 transition-colors ${selectedIds.has(asset.id) ? "bg-primary/5" : ""}`}>
                    {canManage && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="accent-primary size-4"
                          checked={selectedIds.has(asset.id)}
                          onChange={() => toggleSelect(asset.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs">{inv?.serialNumber ?? "—"}</td>
                    <td className="px-4 py-3">{inv?.model ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {inv?.imageType || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {sColor ? (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${sColor.bg} ${sColor.text}`}>
                          <span className={`inline-block size-2 rounded-full ${sColor.dot}`} />
                          {inv!.stickerColour}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{order.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {order.engineerName ? (
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" /> {order.engineerName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {order.warehouseLocation ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {order.warehouseLocation}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {order.provisioningLocation ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {order.provisioningLocation}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ASSET_STATUS_STYLES[asset.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {asset.status === "os_installed" ? "OS Installed" : asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {nextStatus && (
                            <button
                              onClick={() => handleStatusUpdate(asset.id, nextStatus.status)}
                              className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors whitespace-nowrap"
                            >
                              {nextStatus.label}
                            </button>
                          )}
                          {asset.status === "os_installed" && inv?.trackingStatus !== "Handed Over to Logistics" && order.status !== "DOCKET_ASSIGNED" && (
                            <button
                              onClick={() => handleHandoverToLogistics([order.id])}
                              className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors whitespace-nowrap"
                            >
                              Handed over to Logistics
                            </button>
                          )}
                          {asset.status === "os_installed" && (inv?.trackingStatus === "Handed Over to Logistics" || order.status === "DOCKET_ASSIGNED") && (
                            <span className="text-xs text-green-600 font-semibold">Handed Over</span>
                          )}
                          <button onClick={() => openEdit(order)}
                            className="p-1 rounded hover:bg-muted transition-colors" title="Edit provisioning details"
                          ><Edit3 className="size-3.5 text-muted-foreground" /></button>
                          <button onClick={() => handleRemove(order.id)}
                            className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Remove from provisioning"
                          ><Undo2 className="size-3.5 text-destructive" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {editOrderId && editDefaults && (
        <ProvisioningEditModal
          orderId={editOrderId}
          defaults={editDefaults}
          onClose={() => { setEditOrderId(null); setEditDefaults(null); }}
        />
      )}
    </>
  );
}
