"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  ClipboardCheck,
  Cpu,
  HardDrive,
  CheckCircle2,
  XCircle,
  LifeBuoy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { recordCleanQc, recordPurgeQc, logHpCase } from "@/app/actions/reverse-pickup";
import { QcResultBadge } from "@/components/qc/qc-panel";

/**
 * The reverse QC engineer works their own queue here. A unit arrives at Hardware
 * QC (RECEIVED_AT_WAREHOUSE); once it passes it moves to Software QC
 * (QC_CLEANED). If either stage fails the engineer logs an HP case in the same
 * step, which parks the request under CASE_LOGGED_WITH_HP for the HP Cases tab.
 */
export interface ReverseQcPanelItem {
  id: string;
  requestNumber: string;
  serialNumber: string;
  model: string;
  employeeName: string | null;
  status: string;
  warehouseLocation: string | null;
  qcEngineer: string | null;
  qcCleanResult: string | null;
  qcCleanRemarks: string | null;
  qcCleanBy: string | null;
  qcPurgeResult: string | null;
  qcPurgeRemarks: string | null;
  qcPurgeBy: string | null;
}

export function ReverseQcPanel({ item, onClose }: { item: ReverseQcPanelItem; onClose: () => void }) {
  const { toast } = useToast();
  const router = useRouter();

  // The unit's status tells us which stage is open: at the warehouse awaiting
  // Hardware QC, or past it and awaiting Software QC.
  const stage: "clean" | "purge" = item.status === "QC_CLEANED" ? "purge" : "clean";
  const isHardware = stage === "clean";
  const existingResult = isHardware ? item.qcCleanResult : item.qcPurgeResult;
  const existingRemarks = isHardware ? item.qcCleanRemarks : item.qcPurgeRemarks;
  const existingBy = isHardware ? item.qcCleanBy : item.qcPurgeBy;
  const otherResult = isHardware ? item.qcPurgeResult : item.qcCleanResult;

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(existingResult);
  const [remarks, setRemarks] = useState(existingRemarks ?? "");
  const [hpCaseNumber, setHpCaseNumber] = useState("");
  const [hpRemarks, setHpRemarks] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!result) {
      toast({ title: "Validation", description: "Please select a QC result.", variant: "error" });
      return;
    }
    if (result === "FAIL" && !hpCaseNumber.trim()) {
      toast({ title: "Validation", description: "An HP case number is required when the QC stage fails.", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("id", item.id);
      if (isHardware) {
        fd.set("qcCleanResult", result);
        fd.set("qcCleanRemarks", remarks);
        fd.set("qcCleanBy", "");
        await recordCleanQc(fd);
      } else {
        fd.set("qcPurgeResult", result);
        fd.set("qcPurgeRemarks", remarks);
        fd.set("qcPurgeBy", "");
        await recordPurgeQc(fd);
      }

      if (result === "FAIL") {
        const hp = new FormData();
        hp.set("id", item.id);
        hp.set("hpCaseNumber", hpCaseNumber.trim());
        hp.set("hpCaseRemarks", hpRemarks);
        await logHpCase(hp);
        toast({
          title: "Case logged with HP",
          description: `${isHardware ? "Hardware" : "Software"} QC failed for ${item.serialNumber}. Logged case ${hpCaseNumber.trim()}.`,
          variant: "success",
        });
      } else {
        toast({
          title: "QC recorded",
          description: `${isHardware ? "Hardware" : "Software"} QC passed for ${item.serialNumber}.`,
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

  const skipStage = isHardware ? "software" : "hardware";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-background rounded-2xl shadow-2xl border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isHardware ? "bg-orange-100" : "bg-indigo-100"}`}>
              {isHardware ? <Cpu className="size-5 text-orange-600" /> : <HardDrive className="size-5 text-indigo-600" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{isHardware ? "Hardware" : "Software"} QC</h2>
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
            <div>
              <p className="text-xs text-muted-foreground">Warehouse</p>
              <p className="font-medium">{item.warehouseLocation || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">QC Engineer</p>
              <p className="font-medium">{item.qcEngineer || "—"}</p>
            </div>
          </div>

          <div className="rounded-lg border p-3 flex items-center justify-between text-sm">
            <span className="font-medium capitalize">{skipStage} QC</span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {otherResult ? <QcResultBadge result={otherResult} /> : <span className="text-xs italic">Not recorded</span>}
            </span>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-amber-600" />
                <span className="text-sm font-semibold">{isHardware ? "Hardware" : "Software"} QC result</span>
                <QcResultBadge result={existingResult} />
              </div>
            </div>
            {existingResult && existingBy && (
              <p className="text-xs text-muted-foreground">Performed by {existingBy}</p>
            )}

            <div className="flex gap-3">
              {["PASS", "FAIL"].map(v => (
                <label key={v} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="qc-result"
                    value={v}
                    checked={result === v}
                    onChange={() => setResult(v)}
                    className="accent-primary"
                  />
                  {v === "PASS" ? "Pass" : "Fail"}
                </label>
              ))}
            </div>

            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Remarks (issues found, cleaning notes, etc.)"
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />

            {result === "FAIL" && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                  <LifeBuoy className="size-4" />
                  Log case with HP
                </div>
                <p className="text-xs text-red-600">
                  A failed QC stage must be logged with HP before the unit can be re-queued for QC.
                </p>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    HP Case Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={hpCaseNumber}
                    onChange={e => setHpCaseNumber(e.target.value)}
                    placeholder="HP case reference"
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">HP Case Remarks</label>
                  <textarea
                    value={hpRemarks}
                    onChange={e => setHpRemarks(e.target.value)}
                    rows={2}
                    placeholder="What was reported to HP..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
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
                result === "FAIL" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : result === "FAIL" ? <XCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
              {saving ? "Saving..." : result === "FAIL" ? "Record Fail & Log HP Case" : "Record Pass"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
