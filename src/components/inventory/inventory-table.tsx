"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Trash2, Send } from "lucide-react";
import { deleteInventoryItem, sendToWarehouse } from "@/app/actions/inventory";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { InventoryDetailDrawer } from "./inventory-detail-drawer";

interface LatestAssignment {
  employeeName: string | null;
  emailId: string | null;
  purpose: string | null;
  requestDate: string | null;
  mobileNumber: string | null;
}

interface InventoryItem {
  id: string;
  serialNumber: string;
  model: string;
  specs: string | null;
  status: string;
  partner: string | null;
  sr: number | null;
  entity: string | null;
  userBaseLocation: string | null;
  imageType: string | null;
  purpose: string | null;
  requestDate: Date | null;
  count: number | null;
  employeeName: string | null;
  emailId: string | null;
  shippingAddress: string | null;
  landMark: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  mobileNumber: string | null;
  pwcRemarks: string | null;
  laptopMake: string | null;
  laptopModel: string | null;
  invoiceProductDescription: string | null;
  description: string | null;
  emailReceivedHour: string | null;
  cutOffStatus: string | null;
  slaStartDate: Date | null;
  slaState: string | null;
  zone: string | null;
  tier: string | null;
  odaLocation: string | null;
  tat: string | null;
  deliveryTatDays: number | null;
  actualDeliveryDate: Date | null;
  slaStatus: string | null;
  laptopAcceptanceDate: Date | null;
  invoicedQuantity: number | null;
  warrantyPeriod: string | null;
  warrantyEndPeriod: Date | null;
  customerInstructionDoc: string | null;
  adaptorAdded: string | null;
  accessoryHeadsetMouse: string | null;
  stickerColour: string | null;
  deliveryDate: Date | null;
  dc: string | null;
  vendor: string | null;
  deliveredLocation: string | null;
  docketNumber: string | null;
  trackingStatus: string | null;
  trackingSubStatus: string | null;
  pickupDate: Date | null;
  alternatePhoneNumber: string | null;
  processStatus: string | null;
  machineWs1Status: string | null;
  serialNoInWs1: string | null;
  dateOfWs1Update: Date | null;
  servicesStartDate: Date | null;
  invoicingWarehouse: string | null;
  boxSerialNo: string | null;
  checkField: string | null;
  remark: string | null;
  dcNumber: string | null;
  date: Date | null;
  csvStatus: string | null;
  _latestAssignment: LatestAssignment | null;
}

function statusColor(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("delivered") || v.includes("confirmed") || v.includes("received")) return "bg-green-100 text-green-700";
  if (v.includes("dispatched") || v.includes("invoiced") || v.includes("payment")) return "bg-emerald-100 text-emerald-700";
  if (v.includes("allocated")) return "bg-blue-100 text-blue-700";
  if (v.includes("provisioning") || v.includes("dc generated") || v.includes("packed") || v.includes("labelled")) return "bg-indigo-100 text-indigo-700";
  if (v.includes("docket") || v.includes("eway")) return "bg-cyan-100 text-cyan-700";
  if (v.includes("placed") || v.includes("pending")) return "bg-yellow-100 text-yellow-700";
  if (v.includes("order")) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export function InventoryTable({ items, isAdmin, selectedId, totalCount, currentPage, pageSize }: { items: InventoryItem[]; isAdmin?: boolean; selectedId?: string; totalCount: number; currentPage: number; pageSize: number }) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  // Auto-open drawer when selectedId is set (from search)
  useEffect(() => {
    if (selectedId) {
      const match = items.find(i => i.id === selectedId);
      if (match) {
        setSelectedItem(match);
        // Clean URL param after opening
        const url = new URL(window.location.href);
        url.searchParams.delete("selected");
        window.history.replaceState({}, "", url.pathname);
      }
    }
  }, [selectedId, items]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const { toast } = useToast();
  const { showAlert } = useAlert();

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const ok = await showAlert({
      title: "Delete item?",
      description: "This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    try {
      await deleteInventoryItem(id);
      toast({ title: "Deleted", description: "Item removed successfully.", variant: "success" });
      if (selectedItem?.id === id) setSelectedItem(null);
      // Remove from selection if deleted
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  async function handleSendToWarehouse(ids: string[]) {
    if (ids.length === 0) return;
    const ok = await showAlert({
      title: `Send to Warehouse?`,
      description: `This will create a dispatch order for ${ids.length} item(s) and move them into the warehouse pipeline.`,
      confirmLabel: "Send",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setIsSending(true);
    try {
      await sendToWarehouse(ids);
      toast({ title: "Success", description: "Items sent to warehouse pipeline.", variant: "success" });
      setSelectedIds(new Set()); // clear selection
      router.push("/dashboard/warehouse");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send to warehouse", variant: "error" });
    } finally {
      setIsSending(false);
    }
  }

  const toggleSelectAll = () => {
    const sendableOnPage = items.filter(i => i.status === "AVAILABLE" || i.status === "ALLOCATED").map(i => i.id);
    if (sendableOnPage.length === 0) return;
    
    const allSelected = sendableOnPage.every(id => selectedIds.has(id));
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        sendableOnPage.forEach(id => next.delete(id));
      } else {
        sendableOnPage.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSendableOnPageSelected = items.length > 0 && 
    items.filter(i => i.status === "AVAILABLE" || i.status === "ALLOCATED").length > 0 &&
    items.filter(i => i.status === "AVAILABLE" || i.status === "ALLOCATED").every(i => selectedIds.has(i.id));

  return (
    <div className="relative">
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between rounded-t-xl sticky top-0 z-10 shadow-md transition-all animate-fade-in-up">
          <span className="font-semibold text-sm">{selectedIds.size} item(s) selected</span>
          <button
            disabled={isSending}
            onClick={() => handleSendToWarehouse(Array.from(selectedIds))}
            className="flex items-center gap-2 bg-primary-foreground text-primary px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50"
          >
            <Send className="size-4" />
            {isSending ? "Sending..." : "Send to Warehouse"}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-4 py-4 w-12 text-center">
                <input 
                  type="checkbox" 
                  className="accent-primary size-4 rounded cursor-pointer"
                  checked={allSendableOnPageSelected}
                  onChange={toggleSelectAll}
                  disabled={items.filter(i => i.status === "AVAILABLE" || i.status === "ALLOCATED").length === 0}
                  title="Select all available on this page"
                />
              </th>
              <th className="px-4 py-4 font-semibold">Serial Number</th>
              <th className="px-4 py-4 font-semibold">Model</th>
              <th className="px-4 py-4 font-semibold">Status</th>
              <th className="px-4 py-4 font-semibold">Employee Name</th>
              <th className="px-4 py-4 font-semibold">Tracking Status</th>
              <th className="px-4 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                  No inventory found.
                </td>
              </tr>
            ) : (
              items.map(item => {
                const a = item._latestAssignment;
                const canSend = item.status === "AVAILABLE" || item.status === "ALLOCATED";
                const isSelected = selectedIds.has(item.id);

                return (
                <tr
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`transition-colors cursor-pointer ${
                    isSelected ? "bg-primary/5" : "hover:bg-muted/10"
                  }`}
                >
                  <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    {canSend && (
                      <input 
                        type="checkbox"
                        className="accent-primary size-4 rounded cursor-pointer"
                        checked={isSelected}
                        onChange={(e) => toggleSelect(e as any, item.id)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-4 font-medium whitespace-nowrap">{item.serialNumber}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{item.model}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                      item.status === 'ALLOCATED' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">{a?.employeeName ?? item.employeeName}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {item.trackingStatus ? (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        statusColor(item.trackingStatus)
                      }`}>
                        {item.trackingStatus}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {canSend && (
                        <button
                          onClick={() => handleSendToWarehouse([item.id])}
                          disabled={isSending}
                          className="flex items-center gap-1.5 rounded-md bg-primary/10 text-primary px-2.5 py-1 text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                          title="Send strictly this item to Warehouse"
                        >
                          <Send className="size-3.5" />
                          Send
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => handleDelete(e, item.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => { router.push(`/dashboard/inventory?page=1&limit=${e.target.value}`); }}
            className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {[10, 25, 50, 100].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>
            {totalCount === 0 ? "0 items" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalCount)} of ${totalCount}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(`/dashboard/inventory?page=${safePage - 1}&limit=${pageSize}`)}
            disabled={safePage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-3 text-sm text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          <button
            onClick={() => router.push(`/dashboard/inventory?page=${safePage + 1}&limit=${pageSize}`)}
            disabled={safePage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {selectedItem && (
        <InventoryDetailDrawer
          item={selectedItem}
          isAdmin={!!isAdmin}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
