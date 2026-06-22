"use client";

import { useState } from "react";
import { Edit3, Undo2, User, MapPin } from "lucide-react";
import { updateAssetStatus, removeFromProvisioning, updateOrderProvisioningDetails, getProvisioningDropdowns, addProvisioningDropdownOption, deleteProvisioningDropdownOption } from "@/app/actions/provisioning";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ProvisioningEditModal } from "./provisioning-edit-modal";

const ASSET_STATUS_STYLES: Record<string, string> = {
  pending:     "bg-yellow-100 text-yellow-700",
  allocated:   "bg-blue-100 text-blue-700",
  qc_pass:     "bg-green-100 text-green-700",
  os_installed:"bg-purple-100 text-purple-700",
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
}

export function ProvisioningTable({ orders, canManage, engineers }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [editDefaults, setEditDefaults] = useState<{ warehouseLocation: string; provisioningLocation: string; engineerName: string } | null>(null);

  const rows = orders.flatMap(order =>
    order.assets.map(asset => ({ order, asset }))
  );

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
      <div className="rounded-xl glass shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
              <tr>
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
              {rows.map(({ order, asset }) => {
                const inv = asset.inventoryItem;
                const sColor = inv?.stickerColour
                  ? STICKER_COLORS[inv.stickerColour.toLowerCase()]
                  : null;
                const nextStatus = asset.status === "allocated"
                  ? { label: "Mark QC Pass", status: "qc_pass" }
                  : asset.status === "qc_pass"
                  ? { label: "Mark OS Installed", status: "os_installed" }
                  : null;

                return (
                  <tr key={asset.id} className="hover:bg-muted/10 transition-colors">
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
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {order.provisioningLocation ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {order.provisioningLocation}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ASSET_STATUS_STYLES[asset.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {asset.status === "os_installed" ? "OS Installed" : asset.status === "qc_pass" ? "QC Pass" : asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
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
                          {asset.status === "os_installed" && (
                            <span className="text-xs text-green-600 font-semibold">Done</span>
                          )}
                          <button
                            onClick={() => openEdit(order)}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            title="Edit provisioning details"
                          >
                            <Edit3 className="size-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleRemove(order.id)}
                            className="p-1 rounded hover:bg-destructive/10 transition-colors"
                            title="Remove from provisioning"
                          >
                            <Undo2 className="size-3.5 text-destructive" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
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
