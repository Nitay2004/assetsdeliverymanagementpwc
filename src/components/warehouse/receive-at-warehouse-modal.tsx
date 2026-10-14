"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Warehouse } from "lucide-react";
import { receiveAtWarehouse } from "@/app/actions/reverse-pickup";
import { useToast } from "@/hooks/use-toast";

interface Props {
  requestId: string;
  requestNumber: string;
  serialNumber: string;
  warehouseLocations: string[];
  open: boolean;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function ReceiveAtWarehouseModal({
  requestId,
  requestNumber,
  serialNumber,
  warehouseLocations,
  open,
  onClose,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [warehouse, setWarehouse] = useState("");
  const [receivedDate, setReceivedDate] = useState(today);
  const [receivedBy, setReceivedBy] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!warehouse) {
      toast({ title: "Validation", description: "Warehouse is required.", variant: "error" });
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("id", requestId);
      fd.append("warehouseLocation", warehouse);
      fd.append("receivedDate", receivedDate);
      fd.append("receivedBy", receivedBy);
      await receiveAtWarehouse(fd);
      toast({
        title: "Received at warehouse",
        description: `${serialNumber} marked as received at ${warehouse}.`,
        variant: "success",
      });
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
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Warehouse className="size-5 text-cyan-600" />
            <h2 className="text-lg font-semibold text-foreground">Receive at Warehouse</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{serialNumber}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Request {requestNumber}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="warehouseLocation" className="text-sm font-medium text-foreground">
                Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                id="warehouseLocation"
                value={warehouse}
                onChange={e => setWarehouse(e.target.value)}
                required
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select warehouse...</option>
                {warehouseLocations.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
              {warehouseLocations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No warehouse options configured. Ask an administrator to add one.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="receivedDate" className="text-sm font-medium text-foreground">Received Date</label>
                <input
                  id="receivedDate"
                  type="date"
                  value={receivedDate}
                  onChange={e => setReceivedDate(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="receivedBy" className="text-sm font-medium text-foreground">Received By</label>
                <input
                  id="receivedBy"
                  value={receivedBy}
                  onChange={e => setReceivedBy(e.target.value)}
                  placeholder="Person name"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Saving..." : "Mark Received"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
