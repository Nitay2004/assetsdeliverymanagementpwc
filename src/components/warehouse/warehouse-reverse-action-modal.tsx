"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Warehouse, Cpu, HardDrive, Eraser, AlertTriangle, Package, type LucideIcon } from "lucide-react";
import {
  receiveAtWarehouse,
  recordCleanQc,
  recordPurgeQc,
  recordBlancoClear,
  recordBlancoPurge,
  logHpCase,
  completeReversePickup,
} from "@/app/actions/reverse-pickup";
import { useToast } from "@/hooks/use-toast";

export type WarehouseReverseAction =
  | "receive"
  | "cleanQc"
  | "purgeQc"
  | "blancoClear"
  | "blancoPurge"
  | "logHp"
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
const TEXTAREA = "flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none";
const LABEL = "text-sm font-medium text-foreground";

const ACTION_META: Record<WarehouseReverseAction, { title: string; cta: string; button: string; icon: LucideIcon }> = {
  receive: { title: "Receive at Warehouse", cta: "Mark Received", button: "bg-cyan-600 hover:bg-cyan-700", icon: Warehouse },
  cleanQc: { title: "Record Hardware QC", cta: "Record Hardware QC", button: "bg-indigo-600 hover:bg-indigo-700", icon: Cpu },
  purgeQc: { title: "Record Software QC", cta: "Record Software QC", button: "bg-violet-600 hover:bg-violet-700", icon: HardDrive },
  blancoClear: { title: "Record Blanco Clear", cta: "Record Blanco Clear", button: "bg-sky-600 hover:bg-sky-700", icon: Eraser },
  blancoPurge: { title: "Record Blanco Purge", cta: "Record Blanco Purge", button: "bg-teal-600 hover:bg-teal-700", icon: Eraser },
  logHp: { title: "Log Case with HP", cta: "Log Case with HP", button: "bg-amber-600 hover:bg-amber-700", icon: AlertTriangle },
  complete: { title: "Move Back to Inventory", cta: "Move to Inventory", button: "bg-emerald-600 hover:bg-emerald-700", icon: Package },
};

export function WarehouseReverseActionModal({ item, action, warehouseLocations, open, onClose }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [warehouse, setWarehouse] = useState(item.warehouseLocation ?? "");
  const [receivedDate, setReceivedDate] = useState(today);
  const [receivedBy, setReceivedBy] = useState("");
  const [result, setResult] = useState("");
  const [date, setDate] = useState(today);
  const [performedBy, setPerformedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [hpCaseNumber, setHpCaseNumber] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificateDate, setCertificateDate] = useState(today);

  if (!open) return null;

  const meta = ACTION_META[action];
  const requiresResult = action === "cleanQc" || action === "purgeQc" || action === "blancoClear" || action === "blancoPurge";
  const Icon = meta.icon;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (action === "receive" && !warehouse) {
      toast({ title: "Validation", description: "Warehouse is required.", variant: "error" });
      return;
    }
    if (requiresResult && !result) {
      toast({ title: "Validation", description: "Result is required.", variant: "error" });
      return;
    }
    if (action === "logHp" && !hpCaseNumber.trim()) {
      toast({ title: "Validation", description: "HP case number is required.", variant: "error" });
      return;
    }
    if (action === "blancoPurge" && !certificateFile) {
      toast({ title: "Validation", description: "Blancco certificate file is required.", variant: "error" });
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
      } else if (action === "cleanQc") {
        fd.set("qcCleanResult", result);
        fd.set("qcCleanDate", date);
        fd.set("qcCleanBy", performedBy);
        fd.set("qcCleanRemarks", remarks);
        await recordCleanQc(fd);
        toast({ title: "Hardware QC recorded", description: `${item.serialNumber}: ${result}.`, variant: "success" });
      } else if (action === "purgeQc") {
        fd.set("qcPurgeResult", result);
        fd.set("qcPurgeDate", date);
        fd.set("qcPurgeBy", performedBy);
        fd.set("qcPurgeRemarks", remarks);
        await recordPurgeQc(fd);
        toast({ title: "Software QC recorded", description: `${item.serialNumber}: ${result}.`, variant: "success" });
      } else if (action === "blancoClear") {
        fd.set("blancoClearResult", result);
        fd.set("blancoClearDate", date);
        fd.set("blancoClearBy", performedBy);
        fd.set("blancoClearRemarks", remarks);
        await recordBlancoClear(fd);
        toast({ title: "Blanco Clear recorded", description: `${item.serialNumber}: ${result}.`, variant: "success" });
      } else if (action === "blancoPurge") {
        const ext = certificateFile?.name.split(".").pop()?.toLowerCase() ?? "";
        if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
          throw new Error("Only PDF, JPG, JPEG and PNG files are allowed.");
        }
        const up = new FormData();
        up.set("file", certificateFile!);
        const res = await fetch("/api/upload", { method: "POST", body: up });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        fd.set("blancoPurgeResult", result);
        fd.set("blancoPurgeDate", date);
        fd.set("blancoPurgeBy", performedBy);
        fd.set("blancoPurgeRemarks", remarks);
        fd.set("blancoCertificateUrl", data.url);
        fd.set("blancoCertificateDate", certificateDate);
        await recordBlancoPurge(fd);
        toast({ title: "Blanco Purge recorded", description: `${item.serialNumber}: ${result}.`, variant: "success" });
      } else if (action === "logHp") {
        fd.set("hpCaseNumber", hpCaseNumber.trim());
        fd.set("hpCaseRemarks", remarks);
        await logHpCase(fd);
        toast({ title: "Case logged with HP", description: `${item.serialNumber} parked for HP resolution.`, variant: "success" });
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

            {requiresResult && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="result" className={LABEL}>Result <span className="text-red-500">*</span></label>
                  <select id="result" value={result} onChange={e => setResult(e.target.value)} required className={INPUT}>
                    <option value="">Select result...</option>
                    <option value="PASS">Pass</option>
                    <option value="FAIL">Fail</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="date" className={LABEL}>Date</label>
                    <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="performedBy" className={LABEL}>Performed By</label>
                    <input id="performedBy" value={performedBy} onChange={e => setPerformedBy(e.target.value)} placeholder="Name" className={INPUT} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="remarks" className={LABEL}>Remarks</label>
                  <textarea id="remarks" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Remarks..." className={TEXTAREA} />
                </div>
                {action === "blancoPurge" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="certificateFile" className={LABEL}>Blanco Certificate <span className="text-red-500">*</span></label>
                      <input id="certificateFile" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCertificateFile(e.target.files?.[0] || null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700" />
                      <p className="text-xs text-muted-foreground">PDF, JPG, JPEG or PNG</p>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="certificateDate" className={LABEL}>Certificate Date</label>
                      <input id="certificateDate" type="date" value={certificateDate} onChange={e => setCertificateDate(e.target.value)} className={INPUT} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {action === "logHp" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="hpCaseNumber" className={LABEL}>HP Case Number <span className="text-red-500">*</span></label>
                  <input id="hpCaseNumber" value={hpCaseNumber} onChange={e => setHpCaseNumber(e.target.value)} required className={INPUT} placeholder="HP case reference" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="remarks" className={LABEL}>Remarks</label>
                  <textarea id="remarks" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Remarks..." className={TEXTAREA} />
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
