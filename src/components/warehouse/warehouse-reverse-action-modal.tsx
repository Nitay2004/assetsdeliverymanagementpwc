"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Warehouse, Eraser, Package, type LucideIcon } from "lucide-react";
import {
  receiveAtWarehouse,
  sendForBlanco,
  completeReversePickup,
} from "@/app/actions/reverse-pickup";
import { useToast } from "@/hooks/use-toast";

export type WarehouseReverseAction =
  | "receive"
  | "sendForBlanco"
  | "complete";

export interface WarehouseReverseActionItem {
  id: string;
  requestNumber: string;
  serialNumber: string;
  status: string;
  warehouseLocation: string | null;
  qcResult: string | null;
}

interface Props {
  item: WarehouseReverseActionItem;
  action: WarehouseReverseAction;
  warehouseLocations: string[];
  open: boolean;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const INPUT = "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
const LABEL = "text-sm font-medium text-foreground";

const ACTION_META: Record<WarehouseReverseAction, { title: string; cta: string; button: string; icon: LucideIcon }> = {
  receive: { title: "Receive at Warehouse", cta: "Mark Received", button: "bg-cyan-600 hover:bg-cyan-700", icon: Warehouse },
  sendForBlanco: { title: "Send for Blanco", cta: "Send for Blanco", button: "bg-sky-600 hover:bg-sky-700", icon: Eraser },
  complete: { title: "Move Back to Inventory", cta: "Move to Inventory", button: "bg-emerald-600 hover:bg-emerald-700", icon: Package },
};

export function WarehouseReverseActionModal({ item, action, warehouseLocations, open, onClose }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [warehouse, setWarehouse] = useState(item.warehouseLocation ?? "");
  const [receivedDate, setReceivedDate] = useState(today);
  const [receivedBy, setReceivedBy] = useState("");

  if (!open) return null;

  const meta = ACTION_META[action];
  const Icon = meta.icon;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (action === "receive" && !warehouse) {
      toast({ title: "Validation", description: "Warehouse is required.", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("id", item.id);

      if (action === "receive") {
        fd.set("warehouseLocation", warehouse);
        fd.set("receivedDate", receivedDate);
        fd.set("receivedBy", receivedBy);
        await receiveAtWarehouse(fd);
        toast({ title: "Received at warehouse", description: `${item.serialNumber} marked as received at ${warehouse}.`, variant: "success" });
      } else if (action === "sendForBlanco") {
        await sendForBlanco(fd);
        toast({ title: "Sent for Blanco", description: `${item.serialNumber} handed over to the QC engineer for Blanco.`, variant: "success" });
      } else if (action === "complete") {
        await completeReversePickup(fd);
        toast({ title: "Moved to inventory", description: `${item.serialNumber} returned to inventory.`, variant: "success" });
      }

      router.refresh();
      onClose();
    } catch (err) {
      toast({ title: "Action failed", description: String(err), variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Icon className="size-5 text-cyan-600" />
            <h2 className="text-lg font-semibold text-foreground">{meta.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{item.serialNumber}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Request {item.requestNumber} · Status {item.status}</p>
            </div>

            {action === "receive" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="warehouseLocation" className={LABEL}>Warehouse <span className="text-red-500">*</span></label>
                  <select id="warehouseLocation" value={warehouse} onChange={e => setWarehouse(e.target.value)} required className={INPUT}>
                    <option value="">Select warehouse...</option>
                    {warehouseLocations.map(w => (<option key={w} value={w}>{w}</option>))}
                  </select>
                  {warehouseLocations.length === 0 && (<p className="text-xs text-muted-foreground">No warehouse options configured.</p>)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="receivedDate" className={LABEL}>Received Date</label>
                    <input id="receivedDate" type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} className={INPUT} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="receivedBy" className={LABEL}>Received By</label>
                    <input id="receivedBy" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="Person name" className={INPUT} />
                  </div>
                </div>
              </div>
            )}

            {action === "sendForBlanco" && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-sky-50 border border-sky-200">
                <Eraser className="size-5 text-sky-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-sky-800">Hand the unit over for Blanco</p>
                  <p className="text-xs text-sky-700 mt-0.5">
                    The QC engineer who cleared this unit records Blanco Clear and Purge from their own
                    queue in the Provisioning module. Sending only hands the unit over — it does not
                    record Blanco.
                  </p>
                </div>
              </div>
            )}

            {action === "complete" && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <Package className="size-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Confirm moving back to inventory</p>
                  <p className="text-xs text-emerald-700 mt-0.5">This will mark the request as Completed with disposition RESTOCKED.</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/10">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className={`px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 transition-colors flex items-center gap-2 ${meta.button}`}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Saving..." : meta.cta}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
