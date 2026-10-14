"use client";

import { useState } from "react";
import { ClipboardCheck, Cpu, HardDrive, CheckCheck } from "lucide-react";
import { QcPanel, QcResultBadge, type QcItem } from "@/components/qc/qc-panel";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig, type ColumnFilterValue } from "@/components/shared/column-filter";

export interface ReverseQcItem {
  id: string;
  requestNumber: string;
  serialNumber: string;
  model: string;
  employeeName: string;
  status: string;
  warehouseLocation: string | null;
  // QcPanel compatibility fields
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
}

const REVERSE_QC_COLUMNS: ColumnFilterConfig<ReverseQcItem>[] = [
  { key: "rserial", getValue: r => r.serialNumber },
  { key: "rmodel", getValue: r => r.model },
  { key: "remployee", getValue: r => r.employeeName },
  { key: "rwarehouse", getValue: r => r.warehouseLocation },
  { key: "rclean", getValue: r => r.qcCleanResult },
  { key: "rpurge", getValue: r => r.qcPurgeResult },
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

  const { filteredRows: columnFiltered, distinctValues, filters, applyColumn, activeFilterCount } = useColumnFilters(
    REVERSE_QC_COLUMNS,
    items,
    { distinctValues: columnFilterValues },
  );
  const displayItems = columnFiltered;
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
            {count} unit(s) · {isHardware ? "Record hardware clean results" : "Record software purge results"}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <ColumnFilterHeader
                label="Request #"
                values={distinctValues.rserial ?? []}
                selected={Array.from(filters["rserial"] ?? [])}
                onApply={(v) => applyColumn("rserial", v)}
              />
              <ColumnFilterHeader
                label="Serial Number"
                values={distinctValues.rmodel ?? []}
                selected={Array.from(filters["rmodel"] ?? [])}
                onApply={(v) => applyColumn("rmodel", v)}
              />
              <ColumnFilterHeader
                label="Model"
                values={distinctValues.remployee ?? []}
                selected={Array.from(filters["remployee"] ?? [])}
                onApply={(v) => applyColumn("remployee", v)}
              />
              <ColumnFilterHeader
                label="Employee"
                values={distinctValues.rwarehouse ?? []}
                selected={Array.from(filters["rwarehouse"] ?? [])}
                onApply={(v) => applyColumn("rwarehouse", v)}
              />
              <ColumnFilterHeader
                label="Warehouse"
                values={distinctValues.rclean ?? []}
                selected={Array.from(filters["rclean"] ?? [])}
                onApply={(v) => applyColumn("rclean", v)}
              />
              <ColumnFilterHeader
                label="Clean QC"
                values={distinctValues.rpurge ?? []}
                selected={Array.from(filters["rpurge"] ?? [])}
                onApply={(v) => applyColumn("rpurge", v)}
              />
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {activeFilterCount > 0
                    ? "No units match the current filters."
                    : `No units in ${isHardware ? "Hardware" : "Software"} QC queue.`}
                </td>
              </tr>
            )}
            {displayItems.map(item => {
              const hardwareDone = !!item.qcCleanResult;
              const softwareDone = !!item.qcPurgeResult;
              const fullyDone = hardwareDone && softwareDone;
              return (
                <tr
                  key={item.id}
                  className={fullyDone ? "bg-green-50/40" : hardwareDone && !softwareDone ? "bg-yellow-50/40" : "hover:bg-muted/10"}
                >
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{item.requestNumber}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{item.serialNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.model || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.employeeName || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.warehouseLocation || "—"}</td>
                  <td className="px-4 py-3"><QcResultBadge result={item.qcCleanResult} /></td>
                  <td className="px-4 py-3"><QcResultBadge result={item.qcPurgeResult} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {fullyDone ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                        <CheckCheck className="size-3.5" />
                        Completed
                      </span>
                    ) : canManage ? (
                      <button
                        onClick={() => setActiveId(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                          isHardware
                            ? "bg-orange-600 text-white hover:bg-orange-700"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                      >
                        {isHardware ? <Cpu className="size-3.5" /> : <HardDrive className="size-3.5" />}
                        {isHardware ? "Record Hardware QC" : "Record Software QC"}
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

      {active && <QcPanel item={active as unknown as QcItem} onClose={() => setActiveId(null)} />}
    </div>
  );
}