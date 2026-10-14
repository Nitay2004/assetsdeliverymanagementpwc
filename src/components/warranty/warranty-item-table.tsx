"use client";

import { useSearchParams } from "next/navigation";
import { WarrantyItemRow } from "@/components/warranty/warranty-item-row";
import { ScrollToItem } from "@/components/shared/scroll-to-item";
import { UrlDataTableFilter } from "@/components/shared/data-table-filter";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig, type ColumnFilterValue } from "@/components/shared/column-filter";
import { PaginationBar } from "@/components/shared/pagination-bar";

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
  /** Rows matching the filters across the whole result set; `items` is one page. */
  totalCount?: number;
  currentPage?: number;
  totalPages?: number;
  limit?: number;
  columnFilterValues?: Record<string, ColumnFilterValue[]>;
}

// Only the text columns are filterable server-side; the date columns would offer
// one option per item, so they stay plain headers.
const WARRANTY_COLUMNS: ColumnFilterConfig<ItemData>[] = [
  { key: "serialNumber", getValue: r => r.serialNumber },
  { key: "model", getValue: r => r.model },
  { key: "warrantyPeriod", getValue: r => r.warrantyPeriod },
];

export function WarrantyItemTable({
  items,
  canManage,
  selectedId,
  totalCount,
  currentPage,
  totalPages,
  limit,
  columnFilterValues,
}: Props) {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search") ?? "";

  const { filteredRows: columnFiltered, distinctValues, filters, applyColumn, activeFilterCount } = useColumnFilters(WARRANTY_COLUMNS, items, { distinctValues: columnFilterValues });
  const filteredItems = columnFiltered;
  const showPager = typeof totalCount === "number" && typeof currentPage === "number" && typeof totalPages === "number" && typeof limit === "number";

  return (
    <>
      <div className="rounded-xl glass shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <UrlDataTableFilter placeholder="Search by serial no, model, warranty period..." />
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
                    {activeFilterCount > 0
                      ? "No items match the current filters."
                      : searchQuery
                        ? "No results match your search."
                        : "No inventory items found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPager && (
        <PaginationBar
          basePath="/dashboard/warranty"
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          limit={limit}
        />
      )}
    </>
  );
}
