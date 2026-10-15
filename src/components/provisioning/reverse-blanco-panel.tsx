"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Eraser, ShieldCheck, Upload, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { recordBlancoClear, recordBlancoPurge } from "@/app/actions/reverse-pickup";

/**
 * The QC engineer who cleared the unit also runs Blanco on it. The warehouse only
 * hands the unit over; the engineer records Blanco Clear here (status
 * QC_COMPLETED), then Blanco Purge + certificate (status BLANCO_CLEARED). The
 * warehouse location and QC location are shown as they were captured earlier —
 * nothing is re-typed.
 */
export interface ReverseBlancoPanelItem {
  id: string;
  requestNumber: string;
  serialNumber: string;
  model: string;
  employeeName: string | null;
  status: string;
  warehouseLocation: string | null;
  qcLocation: string | null;
  qcEngineer: string | null;
  blancoSentAt: string | null;
  blancoClearResult: string | null;
  blancoClearRemarks: string | null;
  blancoClearBy: string | null;
  blancoPurgeResult: string | null;
  blancoPurgeRemarks: string | null;
  blancoPurgeBy: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

const INPUT = "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
const LABEL = "text-sm font-medium text-foreground";

export function ReverseBlancoPanel({ item, onClose }: { item: ReverseBlancoPanelItem; onClose: () => void }) {
  const { toast } = useToast();
  const router = useRouter();

  // A unit at QC_COMPLETED is waiting on Blanco Clear; one at BLANCO_CLEARED is
  // waiting on Blanco Purge.
  const stage: "clear" | "purge" = item.status === "BLANCO_CLEARED" ? "purge" : "clear";
  const isClear = stage === "clear";
  const existingResult = isClear ? item.blancoClearResult : item.blancoPurgeResult;
  const existingRemarks = isClear ? item.blancoClearRemarks : item.blancoPurgeRemarks;
  const existingBy = isClear ? item.blancoClearBy : item.blancoPurgeBy;

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(existingResult ?? "PASS");
  const [remarks, setRemarks] = useState(existingRemarks ?? "");
  const [date, setDate] = useState(today());
  // Auto-fetch: the engineer who did the QC is the one who ran Blanco.
  const [performedBy, setPerformedBy] = useState(existingBy ?? item.qcEngineer ?? "");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificateDate, setCertificateDate] = useState(today());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!result) {
      toast({ title: "Validation", description: "Please select a Blanco result.", variant: "error" });
      return;
    }
    if (!isClear && !certificateFile) {
      toast({ title: "Validation", description: "The Blanco certificate file is required for Purge.", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("id", item.id);

      if (isClear) {
        fd.set("blancoClearResult", result);
        fd.set("blancoClearRemarks", remarks);
        fd.set("blancoClearDate", date);
        fd.set("blancoClearBy", performedBy);
        await recordBlancoClear(fd);
        toast({
          title: "Blanco Clear recorded",
          description: `${item.serialNumber}: ${result}.`,
          variant: "success",
        });
      } else {
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
        fd.set("blancoPurgeRemarks", remarks);
        fd.set("blancoPurgeDate", date);
        fd.set("blancoPurgeBy", performedBy);
        fd.set("blancoCertificateUrl", data.url);
        fd.set("blancoCertificateDate", certificateDate);
        await recordBlancoPurge(fd);
        toast({
          title: "Blanco Purge recorded",
          description: `${item.serialNumber}: ${result}. The warehouse can now move it back to inventory.`,
          variant: "success",
        });
      }

      onClose();
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-background rounded-2xl shadow-2xl border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isClear ? "bg-sky-100" : "bg-teal-100"}`}>
              {isClear ? <Eraser className="size-5 text-sky-600" /> : <ShieldCheck className="size-5 text-teal-600" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold">Blanco {isClear ? "Clear" : "Purge"}</h2>
              <p className="text-xs text-muted-foreground">{item.serialNumber} · {item.model || "—"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Request #</p>
              <p className="font-medium font-mono text-xs">{item.requestNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Employee</p>
              <p className="font-medium">{item.employeeName || "—"}</p>
            </div>
          </div>

          {/* Auto-fetched from receipt / QC assignment — shown, not re-entered. */}
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <MapPin className="size-3.5" />
              Locations (auto-fetched)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Warehouse Location</p>
                <p className="font-medium">{item.warehouseLocation || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">QC Location</p>
                <p className="font-medium">{item.qcLocation || "—"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eraser className="size-4 text-amber-600" />
                <span className="text-sm font-semibold">Blanco {isClear ? "Clear" : "Purge"} result</span>
              </div>
              {existingResult && (
                <span className="text-xs text-muted-foreground">Last recorded: {existingResult}</span>
              )}
            </div>

            <div className="flex gap-3">
              {["PASS", "FAIL"].map(v => (
                <label key={v} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="blanco-result"
                    value={v}
                    checked={result === v}
                    onChange={() => setResult(v)}
                    className="accent-primary"
                  />
                  {v === "PASS" ? "Pass" : "Fail"}
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={LABEL}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL}>Performed By</label>
                <input value={performedBy} onChange={e => setPerformedBy(e.target.value)} placeholder="Name" className={INPUT} />
              </div>
            </div>

            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Remarks..."
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />

            {!isClear && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={LABEL}>Blanco Certificate <span className="text-red-500">*</span></label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setCertificateFile(e.target.files?.[0] || null)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700"
                  />
                  <p className="text-xs text-muted-foreground">PDF, JPG, JPEG or PNG</p>
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL}>Certificate Date</label>
                  <input type="date" value={certificateDate} onChange={e => setCertificateDate(e.target.value)} className={INPUT} />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 transition-colors flex items-center gap-2 ${
                isClear ? "bg-sky-600 hover:bg-sky-700" : "bg-teal-600 hover:bg-teal-700"
              }`}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : isClear ? <Eraser className="size-4" /> : <Upload className="size-4" />}
              {saving ? "Saving..." : isClear ? "Record Blanco Clear" : "Record Blanco Purge"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
