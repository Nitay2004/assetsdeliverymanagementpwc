"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { addDocket, deleteDocket, advanceOrderStatus } from "@/app/actions/logistics";
import { useRouter } from "next/navigation";

interface DocketData {
  id: string;
  docketNumber: string | null;
  ewayBillNumber: string | null;
  podDocumentUrl: string | null;
}

interface AssetData {
  id: string;
  inventoryItem: { serialNumber: string } | null;
}

interface OrderData {
  id: string;
  clientName: string;
  deliveryLocation: string;
  totalQuantity: number;
  status: string;
  dockets: DocketData[];
  assets: AssetData[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DC_GENERATED:         { label: "DC Generated",        color: "bg-indigo-100 text-indigo-700" },
  PACKED_AND_LABELLED:  { label: "Packed & Labelled",   color: "bg-cyan-100 text-cyan-700" },
  DOCKET_ASSIGNED:      { label: "Docket Assigned",     color: "bg-blue-100 text-blue-700" },
  EWAY_BILL_REQUESTED:  { label: "E-Way Bill Req.",     color: "bg-yellow-100 text-yellow-700" },
  EWAY_BILL_GENERATED:  { label: "E-Way Bill Gen.",     color: "bg-orange-100 text-orange-700" },
  DISPATCHED:           { label: "Dispatched",           color: "bg-purple-100 text-purple-700" },
  DELIVERED:            { label: "Delivered",            color: "bg-green-100 text-green-700" },
};

const STATUS_FLOW = ["DC_GENERATED", "PACKED_AND_LABELLED", "DOCKET_ASSIGNED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED", "DISPATCHED", "DELIVERED"];

export function LogisticsOrderCard({ order, canManage }: { order: OrderData; canManage: boolean }) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [showDocketForm, setShowDocketForm] = useState(false);
  const [docketNumber, setDocketNumber] = useState("");
  const [ewayBillNumber, setEwayBillNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const statusStyle = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

  async function handleAdvance() {
    if (!nextStatus) return;
    const ok = await showAlert({
      title: `Advance to ${STATUS_LABELS[nextStatus]?.label ?? nextStatus}?`,
      description: `Move this order to the next logistics stage.`,
      confirmLabel: "Advance",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await advanceOrderStatus(order.id, nextStatus);
      toast({ title: "Advanced", description: `Order moved to ${STATUS_LABELS[nextStatus]?.label ?? nextStatus}.`, variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDocket(e: React.FormEvent) {
    e.preventDefault();
    if (!docketNumber.trim()) {
      toast({ title: "Error", description: "Docket number is required.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("orderId", order.id);
      fd.set("docketNumber", docketNumber.trim());
      fd.set("ewayBillNumber", ewayBillNumber.trim());
      await addDocket(fd);
      toast({ title: "Added", description: "Docket added.", variant: "success" });
      setDocketNumber("");
      setEwayBillNumber("");
      setShowDocketForm(false);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDocket(docketId: string) {
    const ok = await showAlert({
      title: "Delete docket?",
      description: "This will permanently remove this docket record.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    try {
      await deleteDocket(docketId);
      toast({ title: "Deleted", description: "Docket removed.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-5 border-b flex flex-wrap items-center justify-between gap-4 bg-muted/10 border-b-black/5 dark:border-b-white/5">
        <div>
          <p className="font-semibold text-foreground text-lg">{order.clientName}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {order.deliveryLocation} &nbsp;·&nbsp; {order.totalQuantity} unit(s)
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusStyle.color}`}>
          {statusStyle.label}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Serial Numbers */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Serial Numbers</p>
          <div className="flex flex-wrap gap-1">
            {order.assets.filter(a => a.inventoryItem).map(a => (
              <span key={a.id} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-mono">
                {a.inventoryItem!.serialNumber}
              </span>
            ))}
          </div>
        </div>

        {/* Dockets */}
        {order.dockets.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dockets</p>
            <div className="space-y-2">
              {order.dockets.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-4 p-2 rounded-lg bg-muted/20">
                  <div className="text-sm">
                    <span className="font-mono font-medium">{d.docketNumber}</span>
                    {d.ewayBillNumber && (
                      <span className="text-muted-foreground ml-3">E-Way: {d.ewayBillNumber}</span>
                    )}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteDocket(d.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {canManage && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-t-black/5 dark:border-t-white/5">
            {nextStatus && (
              <button
                onClick={handleAdvance}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {STATUS_LABELS[nextStatus]?.label ?? nextStatus}
              </button>
            )}

            {showDocketForm ? (
              <form onSubmit={handleAddDocket} className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Docket #</label>
                  <input
                    value={docketNumber}
                    onChange={(e) => setDocketNumber(e.target.value)}
                    className="rounded border px-2 py-1 text-sm bg-background w-32"
                    placeholder="Required"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">E-Way Bill #</label>
                  <input
                    value={ewayBillNumber}
                    onChange={(e) => setEwayBillNumber(e.target.value)}
                    className="rounded border px-2 py-1 text-sm bg-background w-32"
                    placeholder="Optional"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowDocketForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-muted"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowDocketForm(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border hover:bg-muted transition-colors"
              >
                + Add Docket
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
