"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headset, CheckCircle, Loader2, X, AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { resolveHpCase } from "@/app/actions/reverse-pickup";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig } from "@/components/shared/column-filter";

export interface HpCaseItem {
  id: string;
  requestNumber: string;
  serialNumber: string;
  model: string;
  employeeName: string;
  warehouseLocation: string | null;
  qcCleanResult: string | null;
  qcPurgeResult: string | null;
  hpCaseNumber: string;
  hpCaseLoggedAt: string | null;
  hpCaseLoggedBy: string | null;
  hpCaseRemarks: string | null;
}

function failedStage(item: Pick<HpCaseItem, "qcCleanResult">) {
  return item.qcCleanResult === "FAIL" ? "Hardware QC" : "Software QC";
}

const HP_COLUMNS: ColumnFilterConfig<HpCaseItem>[] = [
  { key: "requestNumber", getValue: r => r.requestNumber },
  { key: "serialNumber", getValue: r => r.serialNumber },
  { key: "model", getValue: r => r.model },
  { key: "employeeName", getValue: r => r.employeeName },
  { key: "warehouseLocation", getValue: r => r.warehouseLocation },
  { key: "hpCaseNumber", getValue: r => r.hpCaseNumber },
  { key: "failedStage", getValue: r => failedStage(r) },
  { key: "hpCaseLoggedBy", getValue: r => r.hpCaseLoggedBy },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

export function HpCasesTable({ items }: { items: HpCaseItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [target, setTarget] = useState<HpCaseItem | null>(null);
  const [remarks, setRemarks] = useState("");
  const [pending, setPending] = useState(false);

  const { filteredRows, distinctValues, filters, applyColumn } = useColumnFilters(HP_COLUMNS, items);
  const displayItems = filteredRows;

  if (items.length === 0) {
    return (
      <div className="p-8 rounded-xl glass text-center text-muted-foreground">
        No laptops are currently parked with an open HP case.
      </div>
    );
  }

  async function submitResolve() {
    if (!target) return;
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("id", target.id);
      fd.set("hpCaseResolvedRemarks", remarks);
      await resolveHpCase(fd);
      toast({
        variant: "success",
        title: "Sent back to QC",
        description: `${target.requestNumber} restarts at Hardware QC.`,
      });
      setTarget(null);
      setRemarks("");
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not resolve the case",
        description: e instanceof Error ? e.message : "Something went wrong.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-amber-50/60 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-100">
          <Headset className="size-5 text-amber-700" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">HP Cases — Laptop Parked After QC Failure</h2>
          <p className="text-xs text-muted-foreground">
            {items.length} asset(s) waiting on HP. Blancco stays blocked until a case is resolved.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <ColumnFilterHeader
                label="Request No"
                values={distinctValues.requestNumber ?? []}
                selected={Array.from(filters["requestNumber"] ?? [])}
                onApply={(v) => applyColumn("requestNumber", v)}
              />
              <ColumnFilterHeader
                label="Serial Number"
                values={distinctValues.serialNumber ?? []}
                selected={Array.from(filters["serialNumber"] ?? [])}
                onApply={(v) => applyColumn("serialNumber", v)}
              />
              <ColumnFilterHeader
                label="Model"
                values={distinctValues.model ?? []}
                selected={Array.from(filters["model"] ?? [])}
                onApply={(v) => applyColumn("model", v)}
              />
              <ColumnFilterHeader
                label="Employee"
                values={distinctValues.employeeName ?? []}
                selected={Array.from(filters["employeeName"] ?? [])}
                onApply={(v) => applyColumn("employeeName", v)}
              />
              <ColumnFilterHeader
                label="Warehouse"
                values={distinctValues.warehouseLocation ?? []}
                selected={Array.from(filters["warehouseLocation"] ?? [])}
                onApply={(v) => applyColumn("warehouseLocation", v)}
              />
              <ColumnFilterHeader
                label="HP Case No"
                values={distinctValues.hpCaseNumber ?? []}
                selected={Array.from(filters["hpCaseNumber"] ?? [])}
                onApply={(v) => applyColumn("hpCaseNumber", v)}
              />
              <ColumnFilterHeader
                label="Failed Stage"
                values={distinctValues.failedStage ?? []}
                selected={Array.from(filters["failedStage"] ?? [])}
                onApply={(v) => applyColumn("failedStage", v)}
              />
              <ColumnFilterHeader
                label="Logged By"
                values={distinctValues.hpCaseLoggedBy ?? []}
                selected={Array.from(filters["hpCaseLoggedBy"] ?? [])}
                onApply={(v) => applyColumn("hpCaseLoggedBy", v)}
              />
              <th className="px-4 py-3 font-semibold">Logged On</th>
              <th className="px-4 py-3 font-semibold">Remarks</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayItems.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                  No cases match the selected filters.
                </td>
              </tr>
            )}
            {displayItems.map(item => (
              <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link
                    href={`/dashboard/reverse-pickup/${item.id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {item.requestNumber}
                    <ExternalLink className="size-3" />
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{item.serialNumber}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.model}</td>
                <td className="px-4 py-3 whitespace-nowrap">{item.employeeName || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.warehouseLocation || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap font-medium">{item.hpCaseNumber}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="size-3" />
                    {failedStage(item)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.hpCaseLoggedBy || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(item.hpCaseLoggedAt)}</td>
                <td className="px-4 py-3 max-w-[260px]">
                  <p className="truncate text-muted-foreground" title={item.hpCaseRemarks ?? ""}>
                    {item.hpCaseRemarks || "—"}
                  </p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <button
                    onClick={() => { setTarget(item); setRemarks(""); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="size-3.5" />
                    Resolved — send back to QC
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !pending && setTarget(null)} />
          <div className="relative w-full max-w-lg rounded-xl bg-background shadow-xl border p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Resolved — send back to QC</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {target.requestNumber} ({target.serialNumber}) restarts at Hardware QC. The failed QC
                  results are cleared and the HP case is marked resolved.
                </p>
              </div>
              <button
                onClick={() => setTarget(null)}
                disabled={pending}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">HP Case No</p>
                <p className="font-semibold">{target.hpCaseNumber}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Failed Stage</p>
                <p className="font-semibold">{failedStage(target)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="hpCaseResolvedRemarks" className="text-sm font-medium text-foreground">
                Resolution Remarks
              </label>
              <textarea
                id="hpCaseResolvedRemarks"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                placeholder="What HP did, parts replaced, serial confirmed working..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTarget(null)}
                disabled={pending}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitResolve}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                {pending ? "Sending back..." : "Confirm & restart QC"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
