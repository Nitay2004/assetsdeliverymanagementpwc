"use client";

import { useState } from "react";
import { Warehouse, ArrowRight, Truck, PackageCheck } from "lucide-react";
import { STATUS_LABELS, WAREHOUSE_RECEIVABLE_STATUSES } from "@/lib/reverse-pickup-config";
import { ReceiveAtWarehouseModal } from "@/components/warehouse/receive-at-warehouse-modal";
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
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const receiveItem = items.find(i => i.id === receiveId) ?? null;

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
            {totalCount} unit(s) tracked · {pendingReceiptCount} awaiting receipt. Record which warehouse
            each unit reaches, the received date and who received it.
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
              <th className="px-4 py-3 font-semibold">Received Date</th>
              <th className="px-4 py-3 font-semibold">Received By</th>
              {canManage && <th className="px-4 py-3 font-semibold text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground">
                  {activeFilterCount > 0
                    ? "No units match the current filters."
                    : "No reverse-pickup units are in the warehouse pipeline yet."}
                </td>
              </tr>
            )}
            {filteredRows.map(item => {
              const receivable = RECEIVABLE_STATUSES.includes(item.status);
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
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(item.receivedDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.receivedBy || "—"}</td>
                  {canManage && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {receivable ? (
                        <button
                          onClick={() => setReceiveId(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-700 transition-colors"
                        >
                          Receive
                          <ArrowRight className="size-3.5" />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Received</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {receiveItem && (
        <ReceiveAtWarehouseModal
          requestId={receiveItem.id}
          requestNumber={receiveItem.requestNumber}
          serialNumber={receiveItem.serialNumber}
          warehouseLocations={warehouseLocations}
          open
          onClose={() => setReceiveId(null)}
        />
      )}
    </div>
  );
}
