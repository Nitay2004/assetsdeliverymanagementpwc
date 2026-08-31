"use client";

import { useState } from "react";
import { ClipboardCheck, CheckCheck, UserCog } from "lucide-react";
import { QcPanel, QcResultBadge, type QcItem } from "@/components/qc/qc-panel";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig, type ColumnFilterValue } from "@/components/shared/column-filter";

const QC_WORK_COLUMNS: ColumnFilterConfig<QcItem>[] = [
  { key: "serialNumber", getValue: r => r.serialNumber },
  { key: "model", getValue: r => r.model },
  { key: "employeeName", getValue: r => r.employeeName },
  { key: "invoicingWarehouse", getValue: r => r.invoicingWarehouse },
  { key: "qcCleanResult", getValue: r => r.qcCleanResult },
  { key: "qcPurgeResult", getValue: r => r.qcPurgeResult },
];

export function QcWorkTable({ items, columnFilterValues }: { items: QcItem[]; columnFilterValues?: Record<string, ColumnFilterValue[]> }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find(i => i.id === activeId) ?? null;

  const { filteredRows: columnFiltered, distinctValues, filters, applyColumn, clearColumn } = useColumnFilters(QC_WORK_COLUMNS, items, { distinctValues: columnFilterValues });
  const displayItems = columnFiltered;

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-purple-50/50 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-100">
          <UserCog className="size-5 text-purple-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">My QC Tasks — Assets Assigned to Me</h2>
          <p className="text-xs text-muted-foreground">
            {items.length} asset(s) assigned for QC. Perform Clean &amp; Purge, then hand back to warehouse.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
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
                label="Employee Name"
                values={distinctValues.employeeName ?? []}
                selected={Array.from(filters["employeeName"] ?? [])}
                onApply={(v) => applyColumn("employeeName", v)}
              />
              <ColumnFilterHeader
                label="Warehouse"
                values={distinctValues.invoicingWarehouse ?? []}
                selected={Array.from(filters["invoicingWarehouse"] ?? [])}
                onApply={(v) => applyColumn("invoicingWarehouse", v)}
              />
              <ColumnFilterHeader
                label="Clean QC"
                values={distinctValues.qcCleanResult ?? []}
                selected={Array.from(filters["qcCleanResult"] ?? [])}
                onApply={(v) => applyColumn("qcCleanResult", v)}
              />
              <ColumnFilterHeader
                label="Purge QC"
                values={distinctValues.qcPurgeResult ?? []}
                selected={Array.from(filters["qcPurgeResult"] ?? [])}
                onApply={(v) => applyColumn("qcPurgeResult", v)}
              />
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No assets match the selected filters.
                </td>
              </tr>
            )}
            {displayItems.map(item => {
              const handedOver = !!item.qcCompletedAt;
              return (
                <tr
                  key={item.id}
                  className={handedOver ? "bg-green-50/40 transition-colors" : "hover:bg-muted/10 transition-colors"}
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{item.serialNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.model}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.employeeName || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.invoicingWarehouse || "—"}</td>
                  <td className="px-4 py-3"><QcResultBadge result={item.qcCleanResult} /></td>
                  <td className="px-4 py-3"><QcResultBadge result={item.qcPurgeResult} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {handedOver ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                        <CheckCheck className="size-3.5" />
                        Handed Over
                      </span>
                    ) : (
                      <button
                        onClick={() => setActiveId(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
                      >
                        <ClipboardCheck className="size-3.5" />
                        Start / Open QC
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {active && <QcPanel item={active} onClose={() => setActiveId(null)} />}
    </div>
  );
}
