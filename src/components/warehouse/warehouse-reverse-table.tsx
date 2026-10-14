"use client";

import { useState } from "react";
import { Warehouse, ArrowRight, Truck, PackageCheck } from "lucide-react";
import { STATUS_LABELS, WAREHOUSE_RECEIVABLE_STATUSES } from "@/lib/reverse-pickup-config";
import { WarehouseReverseActionModal, type WarehouseReverseAction, type WarehouseReverseActionItem } from "@/components/warehouse/warehouse-reverse-action-modal";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig, type ColumnFilterValue } from "@/components/shared/column-filter";

export interface WarehouseReverseItem {
  id: string;
  requestNumber: string;
  serialNumber: string;
  model: string;
  employeeName: string;
  status: string;
  warehouseLocation: string | null;
  receivedDate: string | null;
  receivedBy: string | null;
  qcCleanResult: string | null;
  qcPurgeResult: string | null;
  qcResult: string | null;
}

/** Statuses at which the unit is on its way and still needs to be received. */
const RECEIVABLE_STATUSES = WAREHOUSE_RECEIVABLE_STATUSES;

const REVERSE_COLUMNS: ColumnFilterConfig<WarehouseReverseItem>[] = [
  { key: "rrequest", getValue: r => r.requestNumber },
  { key: "rserial", getValue: r => r.serialNumber },
  { key: "rmodel", getValue: r => r.model },
  { key: "remployee", getValue: r => r.employeeName },
  { key: "rstatus", getValue: r => r.status },
  { key: "rwarehouse", getValue: r => r.warehouseLocation },
  { key: "rclean", getValue: r => r.qcCleanResult },
  { key: "rpurge", getValue: r => r.qcPurgeResult },
];

const STATUS_COLORS: Record<string, string> = {
  PICKED_UP: "bg-purple-100 text-purple-700",
  IN_TRANSIT: "bg-sky-100 text-sky-700",
  RECEIVED_AT_WAREHOUSE: "bg-cyan-100 text-cyan-700",
  QC_CLEANED: "bg-indigo-100 text-indigo-700",
  QC_COMPLETED: "bg-indigo-100 text-indigo-700",
  CASE_LOGGED_WITH_HP: "bg-orange-100 text-orange-700",
  BLANCO_CLEARED: "bg-teal-100 text-teal-700",
  BLANCO_PURGED: "bg-teal-100 text-teal-700",
  BLANCO_CERTIFIED: "bg-teal-100 text-teal-700",
  COMPLETED: "bg-green-100 text-green-700",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
}

function ResultBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const v = String(value).toUpperCase();
  const cls = v === "PASS" ? "bg-green-100 text-green-700" : v === "FAIL" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{v}</span>;
}

type ActionPlan = { action: WarehouseReverseAction; label: string; className: string };

function pendingLabel(item: WarehouseReverseItem): string {
  const s = item.status;
  if (s === "CASE_LOGGED_WITH_HP") return "Awaiting HP";
  if (s === "COMPLETED") return "Completed";
  return "—";
}

function actionFor(item: WarehouseReverseItem): ActionPlan | null {
  const receivable = RECEIVABLE_STATUSES.includes(item.status);
  if (receivable) {
    return { action: "receive", label: "Receive", className: "bg-cyan-600 hover:bg-cyan-700" };
  }
  const s = item.status;
  switch (s) {
    case "RECEIVED_AT_WAREHOUSE":
      return { action: "cleanQc", label: "Hardware QC", className: "bg-indigo-600 hover:bg-indigo-700" };
    case "QC_CLEANED":
      return item.qcResult === "FAIL"
        ? { action: "logHp", label: "Log HP Case", className: "bg-amber-600 hover:bg-amber-700" }
        : { action: "purgeQc", label: "Software QC", className: "bg-violet-600 hover:bg-violet-700" };
    case "QC_COMPLETED":
      return item.qcResult === "FAIL"
        ? { action: "logHp", label: "Log HP Case", className: "bg-amber-600 hover:bg-amber-700" }
        : { action: "blancoClear", label: "Blanco Clear", className: "bg-sky-600 hover:bg-sky-700" };
    case "BLANCO_CLEARED":
      return { action: "blancoPurge", label: "Blanco Purge", className: "bg-teal-600 hover:bg-teal-700" };
    case "BLANCO_PURGED":
    case "BLANCO_CERTIFIED":
      return { action: "complete", label: "Move to Inventory", className: "bg-emerald-600 hover:bg-emerald-700" };
    case "CASE_LOGGED_WITH_HP":
    case "COMPLETED":
      return null;
    default:
      return null;
  }
}

export function WarehouseReverseTable({
  items,
  canManage,
  warehouseLocations,
  totalCount,
  pendingReceiptCount,
  columnFilterValues,
}: {
  items: WarehouseReverseItem[];
  canManage: boolean;
  warehouseLocations: string[];
  totalCount: number;
  pendingReceiptCount: number;
  columnFilterValues?: Record<string, ColumnFilterValue[]>;
}) {
  const [dialog, setDialog] = useState<{ item: WarehouseReverseItem; action: WarehouseReverseAction } | null>(null);

  const { filteredRows, distinctValues, filters, applyColumn, activeFilterCount } = useColumnFilters(
    REVERSE_COLUMNS,
    items,
    { distinctValues: columnFilterValues, pageParam: "rpage" },
  );

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-cyan-50/50 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-cyan-100">
          <Warehouse className="size-5 text-cyan-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Reverse — Units at the Warehouse</h2>
          <p className="text-xs text-muted-foreground">
            {totalCount} unit(s) tracked · {pendingReceiptCount} awaiting receipt. The entire reverse pipeline
            (Receive, Hardware QC, Software QC, Blanco Clear, Blanco Purge and Moving back to Inventory) is
            actioned from this tab.
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
                label="H/W QC"
                values={distinctValues.rclean ?? []}
                selected={Array.from(filters["rclean"] ?? [])}
                onApply={(v) => applyColumn("rclean", v)}
              />
              <ColumnFilterHeader
                label="S/W QC"
                values={distinctValues.rpurge ?? []}
                selected={Array.from(filters["rpurge"] ?? [])}
                onApply={(v) => applyColumn("rpurge", v)}
              />
              <th className="px-4 py-3 font-semibold">Received Date</th>
              <th className="px-4 py-3 font-semibold">Received By</th>
              {canManage && <th className="px-4 py-3 font-semibold text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={canManage ? 11 : 10} className="px-4 py-8 text-center text-muted-foreground">
                  {activeFilterCount > 0
                    ? "No units match the current filters."
                    : "No reverse-pickup units are in the warehouse pipeline yet."}
                </td>
              </tr>
            )}
            {filteredRows.map(item => {
              const receivable = RECEIVABLE_STATUSES.includes(item.status);
              const plan = actionFor(item);
              return (
                <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{item.requestNumber}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{item.serialNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.model || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.employeeName || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {receivable && <Truck className="size-3.5" />}
                      {!receivable && item.status === "RECEIVED_AT_WAREHOUSE" && <PackageCheck className="size-3.5" />}
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.warehouseLocation || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><ResultBadge value={item.qcCleanResult} /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><ResultBadge value={item.qcPurgeResult} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(item.receivedDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.receivedBy || "—"}</td>
                  {canManage && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {plan ? (
                        <button
                          onClick={() => setDialog({ item, action: plan.action })}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors ${plan.className}`}
                        >
                          {plan.label}
                          <ArrowRight className="size-3.5" />
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
