"use client";

import { useState } from "react";
import { Eraser, ShieldCheck, ArrowRight } from "lucide-react";
import { QcResultBadge } from "@/components/qc/qc-panel";
import { ReverseStatusBadge } from "@/components/reverse-pickup/reverse-status-badge";
import { ReverseBlancoPanel, type ReverseBlancoPanelItem } from "@/components/provisioning/reverse-blanco-panel";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig, type ColumnFilterValue } from "@/components/shared/column-filter";

export interface ReverseBlancoItem {
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

// Keys must match the server's REVERSE_BLANCO_FILTER_KEYS so the URL params the
// header writes are the ones the provisioning page reads back.
const REVERSE_BLANCO_COLUMNS: ColumnFilterConfig<ReverseBlancoItem>[] = [
  { key: "rblserial", getValue: r => r.serialNumber },
  { key: "rblmodel", getValue: r => r.model },
  { key: "rblemployee", getValue: r => r.employeeName },
  { key: "rblwarehouse", getValue: r => r.warehouseLocation },
  { key: "rblclear", getValue: r => r.blancoClearResult },
  { key: "rblpurge", getValue: r => r.blancoPurgeResult },
];

export function ReverseBlancoTable({
  items,
  totalCount,
  columnFilterValues,
  canManage,
}: {
  items: ReverseBlancoItem[];
  totalCount?: number;
  columnFilterValues?: Record<string, ColumnFilterValue[]>;
  canManage: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find(i => i.id === activeId) ?? null;

  const { filteredRows, distinctValues, filters, applyColumn, activeFilterCount } = useColumnFilters(
    REVERSE_BLANCO_COLUMNS,
    items,
    { distinctValues: columnFilterValues, pageParam: "rqcpage" },
  );
  const count = totalCount ?? items.length;

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b flex items-center gap-3 bg-teal-50/50">
        <div className="p-2 rounded-lg bg-teal-100">
          <Eraser className="size-5 text-teal-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Reverse QC — Blanco</h2>
          <p className="text-xs text-muted-foreground">
            {count} unit(s) handed over to you for Blanco. Record Blanco Clear, then Blanco Purge with the
            certificate. The warehouse moves the unit back to inventory once Purge is done.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-4 py-3 font-semibold">Request #</th>
              <ColumnFilterHeader
                label="Serial Number"
                values={distinctValues.rblserial ?? []}
                selected={Array.from(filters["rblserial"] ?? [])}
                onApply={(v) => applyColumn("rblserial", v)}
              />
              <ColumnFilterHeader
                label="Model"
                values={distinctValues.rblmodel ?? []}
                selected={Array.from(filters["rblmodel"] ?? [])}
                onApply={(v) => applyColumn("rblmodel", v)}
              />
              <th className="px-4 py-3 font-semibold">Status</th>
              <ColumnFilterHeader
                label="Employee"
                values={distinctValues.rblemployee ?? []}
                selected={Array.from(filters["rblemployee"] ?? [])}
                onApply={(v) => applyColumn("rblemployee", v)}
              />
              <ColumnFilterHeader
                label="Warehouse"
                values={distinctValues.rblwarehouse ?? []}
                selected={Array.from(filters["rblwarehouse"] ?? [])}
                onApply={(v) => applyColumn("rblwarehouse", v)}
              />
              <th className="px-4 py-3 font-semibold">QC Location</th>
              <ColumnFilterHeader
                label="Blanco Clear"
                values={distinctValues.rblclear ?? []}
                selected={Array.from(filters["rblclear"] ?? [])}
                onApply={(v) => applyColumn("rblclear", v)}
              />
              <ColumnFilterHeader
                label="Blanco Purge"
                values={distinctValues.rblpurge ?? []}
                selected={Array.from(filters["rblpurge"] ?? [])}
                onApply={(v) => applyColumn("rblpurge", v)}
              />
              <th className="px-4 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  {activeFilterCount > 0
                    ? "No units match the current filters."
                    : "No units have been handed over to you for Blanco yet."}
                </td>
              </tr>
            )}
            {filteredRows.map(item => {
              const isClear = item.status !== "BLANCO_CLEARED";
              const done = isClear ? !!item.blancoClearResult : !!item.blancoPurgeResult;
              return (
                <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{item.requestNumber}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{item.serialNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.model || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><ReverseStatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.employeeName || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.warehouseLocation || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.qcLocation || item.warehouseLocation || "—"}</td>
                  <td className="px-4 py-3"><QcResultBadge result={item.blancoClearResult} /></td>
                  <td className="px-4 py-3"><QcResultBadge result={item.blancoPurgeResult} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {canManage ? (
                      <button
                        onClick={() => setActiveId(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors ${
                          isClear ? "bg-sky-600 hover:bg-sky-700" : "bg-teal-600 hover:bg-teal-700"
                        }`}
                      >
                        {isClear ? <Eraser className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                        {done ? "Update" : "Record"} Blanco {isClear ? "Clear" : "Purge"}
                        <ArrowRight className="size-3.5" />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">View only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {active && (
        <ReverseBlancoPanel item={active as ReverseBlancoPanelItem} onClose={() => setActiveId(null)} />
      )}
    </div>
  );
}
