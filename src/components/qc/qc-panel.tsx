"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, ClipboardCheck, Sparkles, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { recordQcClean, recordQcPurge, completeQc } from "@/app/actions/qc";

export interface QcItem {
  id: string;
  serialNumber: string;
  model: string;
  status: string;
  employeeName: string | null;
  emailId: string | null;
  mobileNumber: string | null;
  city: string | null;
  state: string | null;
  invoicingWarehouse: string | null;
  qcLocation: string | null;
  qcRequestedAt: string | null;
  qcEngineer: string | null;
  qcAssignedAt: string | null;
  qcCleanResult: string | null;
  qcCleanRemarks: string | null;
  qcCleanDate: string | null;
  qcCleanBy: string | null;
  qcPurgeResult: string | null;
  qcPurgeRemarks: string | null;
  qcPurgeDate: string | null;
  qcPurgeBy: string | null;
  qcFinalResult: string | null;
  qcCompletedAt: string | null;
}

export function QcResultBadge({ result }: { result: string | null }) {
  if (!result) return <span className="text-xs text-muted-foreground italic">Pending</span>;
  return result === "PASS" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <CheckCircle2 className="size-3" /> Pass
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      <XCircle className="size-3" /> Fail
    </span>
  );
}

function QcStepForm({
  title,
  icon,
  step,
  item,
}: {
  title: string;
  icon: React.ReactNode;
  step: "clean" | "purge";
  item: QcItem;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(step === "clean" ? item.qcCleanResult : item.qcPurgeResult);
  const [remarks, setRemarks] = useState(step === "clean" ? item.qcCleanRemarks : item.qcPurgeRemarks);

  const existingResult = step === "clean" ? item.qcCleanResult : item.qcPurgeResult;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!result) {
      toast({ title: "Error", description: "Please select a QC result.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set(step === "clean" ? "qcCleanResult" : "qcPurgeResult", result);
      fd.set(step === "clean" ? "qcCleanRemarks" : "qcPurgeRemarks", remarks ?? "");
      fd.set(step === "clean" ? "qcCleanBy" : "qcPurgeBy", "");
      if (step === "clean") await recordQcClean(item.id, fd);
      else await recordQcPurge(item.id, fd);
      toast({ title: "Saved", description: `${title} QC recorded.`, variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save QC", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{title} QC</span>
          <QcResultBadge result={existingResult} />
        </div>
      </div>
      {existingResult && (
        <p className="text-xs text-muted-foreground">
          {(() => {
            const by = step === "clean" ? item.qcCleanBy : item.qcPurgeBy;
            const remarks = step === "clean" ? item.qcCleanRemarks : item.qcPurgeRemarks;
            return [by ? `Performed by ${by}` : "", remarks ? `Remarks: ${remarks}` : ""].filter(Boolean).join(" — ");
          })()}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3">
          {["PASS", "FAIL"].map(v => (
            <label key={v} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="radio"
                name={`${step}-result`}
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
          value={remarks ?? ""}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Remarks (issues found, cleaning notes, etc.)"
          rows={2}
          className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
          {existingResult ? "Update" : "Save"} {title} QC
        </button>
      </form>
    </div>
  );
}

export function QcPanel({ item, onClose }: { item: QcItem; onClose: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [finalRemarks, setFinalRemarks] = useState("");

  const bothDone = !!item.qcCleanResult && !!item.qcPurgeResult;

  async function handleComplete() {
    setSaving(true);
    try {
      await completeQc(item.id, finalRemarks || undefined);
      toast({
        title: "Handed over",
        description: "QC completed. Asset moved to warehouse provisioning / marked defective as per result.",
        variant: "success",
      });
      onClose();
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to complete QC", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const allPass = item.qcCleanResult === "PASS" && item.qcPurgeResult === "PASS";
  const handoverLabel = allPass
    ? "PASS — move to warehouse for provisioning"
    : "FAIL — send back to inventory as defective";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-background rounded-2xl shadow-2xl border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <ClipboardCheck className="size-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">QC Panel</h2>
              <p className="text-xs text-muted-foreground">{item.serialNumber} · {item.model}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Assigned User</p>
              <p className="font-medium">{item.employeeName || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium">{item.emailId || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium">{[item.city, item.state].filter(Boolean).join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Warehouse</p>
              <p className="font-medium">{item.invoicingWarehouse || "—"}</p>
            </div>
          </div>

          <div className="rounded-lg border p-3 flex items-center justify-between text-sm">
            <span className="font-medium">QC Engineer</span>
            <span className="text-muted-foreground">{item.qcEngineer || "—"}</span>
          </div>

          <QcStepForm
            title="Clean"
            icon={<Sparkles className="size-4 text-amber-600" />}
            step="clean"
            item={item}
          />

          <QcStepForm
            title="Purge"
            icon={<ShieldCheck className="size-4 text-indigo-600" />}
            step="purge"
            item={item}
          />

          {bothDone && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Handed over to Warehouse</span>
                {allPass ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                    <CheckCircle2 className="size-3" /> {handoverLabel}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    <XCircle className="size-3" /> {handoverLabel}
                  </span>
                )}
              </div>
              <textarea
                value={finalRemarks}
                onChange={e => setFinalRemarks(e.target.value)}
                placeholder="Final remarks (issues found, disposition notes)"
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleComplete}
                disabled={saving}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  allPass ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
                {saving ? "Processing..." : "Handed over to Warehouse"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
