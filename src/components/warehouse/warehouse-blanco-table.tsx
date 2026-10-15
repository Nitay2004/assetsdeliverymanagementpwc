"use client";

import { useState } from "react";
import { Eraser, ArrowRight, Send } from "lucide-react";
import { STATUS_LABELS } from "@/lib/reverse-pickup-config";
import { WarehouseReverseActionModal, type WarehouseReverseAction, type WarehouseReverseActionItem } from "@/components/warehouse/warehouse-reverse-action-modal";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig, type ColumnFilterValue } from "@/components/shared/column-filter";
import type { WarehouseReverseItem } from "@/components/warehouse/warehouse-reverse-table";

const BLANCO_COLUMNS: ColumnFilterConfig<WarehouseReverseItem>[] = [
  { key: "rrequest", getValue: r => r.requestNumber },
  { key: "rserial", getValue: r => r.serialNumber },
  { key: "rmodel", getValue: r => r.model },
  { key: "remployee", getValue: r => r.employeeName },
  { key: "rstatus", getValue: r => r.status },
  { key: "rwarehouse", getValue: r => r.warehouseLocation },
  { key: "rqcengineer", getValue: r => r.qcEngineer },
];

const STATUS_COLORS: Record<string, string> = {
  QC_COMPLETED: "bg-indigo-100 text-indigo-700",
  BLANCO_CLEARED: "bg-teal-100 text-teal-700",
  BLANCO_PURGED: "bg-teal-100 text-teal-700",
  BLANCO_CERTIFIED: "bg-teal-100 text-teal-700",
};

function ResultBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const v = String(value).toUpperCase();
  const cls = v === "PASS" ? "bg-green-100 text-green-700" : v === "FAIL" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{v}</span>;
}

type ActionPlan = { action: WarehouseReverseAction; label: string; className: string };

// Blanco is recorded by the QC engineer, not the warehouse. The warehouse only
// hands a QC-passed unit over ("Send for Blanco") and, once the engineer has
// purged it, moves it back to inventory.
function actionFor(item: WarehouseReverseItem): ActionPlan | null {
  switch (item.status) {
    case "QC_COMPLETED":
      return item.blancoSentAt
        ? null
        : { action: "sendForBlanco", label: "Send for Blanco", className: "bg-sky-600 hover:bg-sky-700" };
    case "BLANCO_PURGED":
    case "BLANCO_CERTIFIED":
      return { action: "complete", label: "Move to Inventory", className: "bg-emerald-600 hover:bg-emerald-700" };
    default:
      // BLANCO_CLEARED — the engineer is part-way through Blanco.
      return null;
  }
}

function pendingLabel(item: WarehouseReverseItem): string {
  if (item.status === "QC_COMPLETED" && item.blancoSentAt) {
    return item.qcEngineer ? `With ${item.qcEngineer} (Blanco Clear)` : "Sent for Blanco";
  }
  if (item.status === "BLANCO_CLEARED") {
    return item.qcEngineer ? `With ${item.qcEngineer} (Blanco Purge)` : "Awaiting Blanco Purge";
  }
  return "—";
}

export function WarehouseBlancoTable({
  items,
  canManage,
  warehouseLocations,
  totalCount,
  columnFilterValues,
}: {
  items: WarehouseReverseItem[];
  canManage: boolean;
  warehouseLocations: string[];
  totalCount: number;
  columnFilterValues?: Record<string, ColumnFilterValue[]>;
}) {
  const [dialog, setDialog] = useState<{ item: WarehouseReverseItem; action: WarehouseReverseAction } | null>(null);

  const { filteredRows, distinctValues, filters, applyColumn, activeFilterCount } = useColumnFilters(
    BLANCO_COLUMNS,
    items,
    { distinctValues: columnFilterValues, pageParam: "rpage" },
  );

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-teal-50/50 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-teal-100">
          <Eraser className="size-5 text-teal-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Reverse — Blanco</h2>
          <p className="text-xs text-muted-foreground">
            {totalCount} unit(s) cleared QC. Hand the unit over with <span className="font-medium">Send for Blanco</span> —
            the QC engineer records Blanco Clear and Purge from their own queue in the Provisioning module. Once purged,
            move the unit back to inventory here.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <ColumnFilterHeader
                label="Request #"
                values={distinctValues.rrequest ?? []}
                selected={Array.from(filters["rrequest"] ?? [])}
                onApply={(v) => applyColumn("rrequest", v)}
              />
              <ColumnFilterHeader
                label="Serial Number"
                values={distinctValues.rserial ?? []}
                selected={Array.from(filters["rserial"] ?? [])}
                onApply={(v) => applyColumn("rserial", v)}
              />
              <ColumnFilterHeader
                label="Model"
                values={distinctValues.rmodel ?? []}
                selected={Array.from(filters["rmodel"] ?? [])}
                onApply={(v) => applyColumn("rmodel", v)}
              />
              <ColumnFilterHeader
                label="Employee"
                values={distinctValues.remployee ?? []}
                selected={Array.from(filters["remployee"] ?? [])}
                onApply={(v) => applyColumn("remployee", v)}
              />
              <ColumnFilterHeader
                label="Status"
                values={distinctValues.rstatus ?? []}
                selected={Array.from(filters["rstatus"] ?? [])}
                onApply={(v) => applyColumn("rstatus", v)}
              />
              <ColumnFilterHeader
                label="Warehouse"
                values={distinctValues.rwarehouse ?? []}
                selected={Array.from(filters["rwarehouse"] ?? [])}
                onApply={(v) => applyColumn("rwarehouse", v)}
              />
              <ColumnFilterHeader
                label="QC Engineer"
                values={distinctValues.rqcengineer ?? []}
                selected={Array.from(filters["rqcengineer"] ?? [])}
                onApply={(v) => applyColumn("rqcengineer", v)}
              />
              <th className="px-4 py-3 font-semibold">H/W QC</th>
              <th className="px-4 py-3 font-semibold">S/W QC</th>
              <th className="px-4 py-3 font-semibold">Blanco Clear</th>
              <th className="px-4 py-3 font-semibold">Blanco Purge</th>
              {canManage && <th className="px-4 py-3 font-semibold text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={canManage ? 12 : 11} className="px-4 py-8 text-center text-muted-foreground">
                  {activeFilterCount > 0
                    ? "No units match the current filters."
                    : "No units are ready for Blanco yet."}
                </td>
              </tr>
            )}
            {filteredRows.map(item => {
              const plan = actionFor(item);
              return (
                <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{item.requestNumber}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{item.serialNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.model || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.employeeName || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.warehouseLocation || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.qcEngineer || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><ResultBadge value={item.qcCleanResult} /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><ResultBadge value={item.qcPurgeResult} /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><ResultBadge value={item.blancoClearResult} /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><ResultBadge value={item.blancoPurgeResult} /></td>
                  {canManage && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {plan ? (
                        <button
                          onClick={() => setDialog({ item, action: plan.action })}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors ${plan.className}`}
                        >
                          {plan.action === "sendForBlanco" ? <Send className="size-3.5" /> : <ArrowRight className="size-3.5" />}
                          {plan.label}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{pendingLabel(item)}</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialog && (
        <WarehouseReverseActionModal
          item={dialog.item as WarehouseReverseActionItem}
          action={dialog.action}
          warehouseLocations={warehouseLocations}
          open
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
