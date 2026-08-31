"use client";

import { useState } from "react";
import { WarrantyItemRow } from "@/components/warranty/warranty-item-row";
import { ScrollToItem } from "@/components/shared/scroll-to-item";
import { DataTableFilter, filterRows } from "@/components/shared/data-table-filter";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig } from "@/components/shared/column-filter";

interface ItemData {
  id: string;
  serialNumber: string;
  model: string;
  warrantyPeriod: string | null;
  warrantyEndPeriod: Date | null;
  servicesStartDate: Date | null;
}

interface Props {
  items: ItemData[];
  canManage: boolean;
  selectedId?: string;
}

const WARRANTY_COLUMNS: ColumnFilterConfig<ItemData>[] = [
  { key: "serialNumber", getValue: r => r.serialNumber },
  { key: "model", getValue: r => r.model },
  { key: "warrantyPeriod", getValue: r => r.warrantyPeriod },
  { key: "warrantyEndPeriod", getValue: r => (r.warrantyEndPeriod ? new Date(r.warrantyEndPeriod).toLocaleDateString("en-GB") : null) },
  { key: "servicesStartDate", getValue: r => (r.servicesStartDate ? new Date(r.servicesStartDate).toLocaleDateString("en-GB") : null) },
];

export function WarrantyItemTable({ items, canManage, selectedId }: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const searchFiltered = filterRows(items, searchQuery, [
    "serialNumber", "model", "warrantyPeriod",
  ]);

  const { filteredRows: columnFiltered, distinctValues, filters, applyColumn, clearColumn } = useColumnFilters(WARRANTY_COLUMNS, searchFiltered);
  const filteredItems = columnFiltered;

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <DataTableFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search by serial no, model, warranty period..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <ColumnFilterHeader
                label="Serial #"
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
                label="Warranty Period"
                values={distinctValues.warrantyPeriod ?? []}
                selected={Array.from(filters["warrantyPeriod"] ?? [])}
                onApply={(v) => applyColumn("warrantyPeriod", v)}
              />
              <ColumnFilterHeader
                label="Warranty End"
                values={distinctValues.warrantyEndPeriod ?? []}
                selected={Array.from(filters["warrantyEndPeriod"] ?? [])}
                onApply={(v) => applyColumn("warrantyEndPeriod", v)}
              />
              <ColumnFilterHeader
                label="Services Start"
                values={distinctValues.servicesStartDate ?? []}
                selected={Array.from(filters["servicesStartDate"] ?? [])}
                onApply={(v) => applyColumn("servicesStartDate", v)}
              />
              {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            <ScrollToItem selectedId={selectedId} prefix="warranty" />
            {filteredItems.map((item) => (
              <WarrantyItemRow key={item.id} item={item} canManage={canManage} elementId={`warranty-${item.id}`} />
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                  {searchQuery ? "No results match your search." : "No inventory items found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
