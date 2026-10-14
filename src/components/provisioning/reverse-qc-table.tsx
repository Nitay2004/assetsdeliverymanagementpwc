"use client";

import { useState } from "react";
import { Cpu, HardDrive, ArrowRight } from "lucide-react";
import { QcResultBadge } from "@/components/qc/qc-panel";
import { ReverseStatusBadge } from "@/components/reverse-pickup/reverse-status-badge";
import { ReverseQcPanel, type ReverseQcPanelItem } from "@/components/provisioning/reverse-qc-panel";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig, type ColumnFilterValue } from "@/components/shared/column-filter";

export interface ReverseQcItem {
  id: string;
  requestNumber: string;
  serialNumber: string;
  model: string;
  employeeName: string | null;
  status: string;
  warehouseLocation: string | null;
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
}

// Keys must match the server's REVERSE_QC_FILTER_KEYS so the URL params the
// header writes are the ones the provisioning page reads back.
const REVERSE_QC_COLUMNS: ColumnFilterConfig<ReverseQcItem>[] = [
  { key: "rqcserial", getValue: r => r.serialNumber },
  { key: "rqcmodel", getValue: r => r.model },
  { key: "rqcemployee", getValue: r => r.employeeName },
  { key: "rqcwarehouse", getValue: r => r.warehouseLocation },
  { key: "rqcclean", getValue: r => r.qcCleanResult },
  { key: "rqcpurge", getValue: r => r.qcPurgeResult },
];

export function ReverseQcTable({
  items,
  subTab,
  totalCount,
  columnFilterValues,
  canManage,
}: {
  items: ReverseQcItem[];
  subTab: "hardware" | "software";
  totalCount?: number;
  columnFilterValues?: Record<string, ColumnFilterValue[]>;
  canManage: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find(i => i.id === activeId) ?? null;

  const { filteredRows, distinctValues, filters, applyColumn, activeFilterCount } = useColumnFilters(
    REVERSE_QC_COLUMNS,
    items,
    { distinctValues: columnFilterValues, pageParam: "rqcpage" },
  );
  const count = totalCount ?? items.length;
  const isHardware = subTab === "hardware";

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className={`p-4 border-b flex items-center gap-3 ${isHardware ? "bg-orange-50/50" : "bg-indigo-50/50"}`}>
        <div className={`p-2 rounded-lg ${isHardware ? "bg-orange-100" : "bg-indigo-100"}`}>
          {isHardware ? <Cpu className="size-5 text-orange-600" /> : <HardDrive className="size-5 text-indigo-600" />}
        </div>
        <div>
          <h2 className="font-semibold text-foreground">
            Reverse QC — {isHardware ? "Hardware QC" : "Software QC"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {count} unit(s) assigned to you ·{" "}
            {isHardware
              ? "Record the hardware check; if it fails, log the case with HP."
              : "Record the software purge; if it fails, log the case with HP."}
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
                values={distinctValues.rqcserial ?? []}
                selected={Array.from(filters["rqcserial"] ?? [])}
                onApply={(v) => applyColumn("rqcserial", v)}
              />
              <ColumnFilterHeader
                label="Model"
                values={distinctValues.rqcmodel ?? []}
                selected={Array.from(filters["rqcmodel"] ?? [])}
                onApply={(v) => applyColumn("rqcmodel", v)}
              />
              <th className="px-4 py-3 font-semibold">Status</th>
              <ColumnFilterHeader
                label="Employee"
                values={distinctValues.rqcemployee ?? []}
                selected={Array.from(filters["rqcemployee"] ?? [])}
                onApply={(v) => applyColumn("rqcemployee", v)}
              />
              <ColumnFilterHeader
                label="Warehouse"
                values={distinctValues.rqcwarehouse ?? []}
                selected={Array.from(filters["rqcwarehouse"] ?? [])}
                onApply={(v) => applyColumn("rqcwarehouse", v)}
              />
              <ColumnFilterHeader
                label="H/W QC"
                values={distinctValues.rqcclean ?? []}
                selected={Array.from(filters["rqcclean"] ?? [])}
                onApply={(v) => applyColumn("rqcclean", v)}
              />
              <ColumnFilterHeader
                label="S/W QC"
                values={distinctValues.rqcpurge ?? []}
                selected={Array.from(filters["rqcpurge"] ?? [])}
                onApply={(v) => applyColumn("rqcpurge", v)}
              />
              <th className="px-4 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  {activeFilterCount > 0
                    ? "No units match the current filters."
                    : `No reverse units assigned to you in ${isHardware ? "Hardware" : "Software"} QC.`}
                </td>
              </tr>
            )}
            {filteredRows.map(item => {
              const done = isHardware ? !!item.qcCleanResult : !!item.qcPurgeResult;
              return (
                <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{item.requestNumber}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{item.serialNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.model || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><ReverseStatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.employeeName || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.warehouseLocation || "—"}</td>
                  <td className="px-4 py-3"><QcResultBadge result={item.qcCleanResult} /></td>
                  <td className="px-4 py-3"><QcResultBadge result={item.qcPurgeResult} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {canManage ? (
                      <button
                        onClick={() => setActiveId(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors ${
                          isHardware ? "bg-orange-600 hover:bg-orange-700" : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        {isHardware ? <Cpu className="size-3.5" /> : <HardDrive className="size-3.5" />}
                        {done ? "Update" : "Record"} {isHardware ? "Hardware" : "Software"} QC
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
        <ReverseQcPanel item={active as ReverseQcPanelItem} onClose={() => setActiveId(null)} />
      )}
    </div>
  );
}
