"use client";

import { useState } from "react";
import { WarrantyItemRow } from "@/components/warranty/warranty-item-row";
import { ScrollToItem } from "@/components/shared/scroll-to-item";
import { DataTableFilter, filterRows } from "@/components/shared/data-table-filter";

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

export function WarrantyItemTable({ items, canManage, selectedId }: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = filterRows(items, searchQuery, [
    "serialNumber", "model", "warrantyPeriod",
  ]);

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <DataTableFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search by serial no, model, warranty period..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold">Serial #</th>
              <th className="px-6 py-4 font-semibold">Model</th>
              <th className="px-6 py-4 font-semibold">Warranty Period</th>
              <th className="px-6 py-4 font-semibold">Warranty End</th>
              <th className="px-6 py-4 font-semibold">Services Start</th>
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
