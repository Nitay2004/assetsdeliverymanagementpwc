"use client";

import { FinanceOrderRow } from "@/components/finance/finance-order-row";
import { ScrollToItem } from "@/components/shared/scroll-to-item";
import { UrlDataTableFilter } from "@/components/shared/data-table-filter";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig, type ColumnFilterValue } from "@/components/shared/column-filter";

interface AssetItem {
  id: string;
  inventoryItem: { id: string; serialNumber: string } | null;
}

interface DocketData {
  id: string;
  docketNumber: string | null;
  courierName: string | null;
  ewayBillNumber: string | null;
  ewayBillDocumentUrl: string | null;
}

interface DcItemData {
  id: string;
  description: string;
  hsnSac: string | null;
  quantity: number;
  rate: number;
  amount: number;
  taxableValue: number | null;
  igstRate: number | null;
  igstAmount: number | null;
}

interface WarehouseData {
  id: string;
  name: string;
  location: string | null;
}

interface DcData {
  id: string;
  dcNumber: string;
  dcDate: string;
  shipToLocation: string | null;
  billToLocation: string | null;
  taxableValue: number | null;
  igst: number | null;
  totalTaxAmount: number | null;
  items: DcItemData[];
  warehouse: WarehouseData | null;
}

interface OrderData {
  id: string;
  clientName: string;
  deliveryLocation: string;
  totalQuantity: number;
  dcNumber: string | null;
  invoiceNumber: string | null;
  status: string;
  assets: AssetItem[];
  deliveryChallans: DcData[];
  dockets: DocketData[];
}

interface Props {
  orders: OrderData[];
  canManage: boolean;
  selectedId?: string;
  columnFilterValues?: Record<string, ColumnFilterValue[]>;
  financeSubTab?: string;
}

const FINANCE_COLUMNS: ColumnFilterConfig<OrderData>[] = [
  { key: "clientName", getValue: r => r.clientName },
  { key: "deliveryLocation", getValue: r => r.deliveryLocation },
  { key: "totalQuantity", getValue: r => r.totalQuantity },
  { key: "serialNumber", getValue: r => r.assets.map(a => a.inventoryItem?.serialNumber).filter(Boolean).join(", ") },
  { key: "dcNumber", getValue: r => r.dcNumber },
  { key: "ewayBill", getValue: r => r.dockets.map(d => d.ewayBillNumber).filter(Boolean).join(", ") },
  { key: "status", getValue: r => r.status },
];

export function FinanceOrderTable({ orders, canManage, selectedId, columnFilterValues, financeSubTab = "dc" }: Props) {
  const { filteredRows: columnFiltered, distinctValues, filters, applyColumn, clearColumn } = useColumnFilters(FINANCE_COLUMNS, orders, { distinctValues: columnFilterValues });
  const filteredOrders = columnFiltered;

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <UrlDataTableFilter placeholder="Search by client, location, serial no, DC, invoice..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <ColumnFilterHeader
                label="Client"
                values={distinctValues.clientName ?? []}
                selected={Array.from(filters["clientName"] ?? [])}
                onApply={(v) => applyColumn("clientName", v)}
              />
              <ColumnFilterHeader
                label="Location"
                values={distinctValues.deliveryLocation ?? []}
                selected={Array.from(filters["deliveryLocation"] ?? [])}
                onApply={(v) => applyColumn("deliveryLocation", v)}
              />
              <ColumnFilterHeader
                label="Units"
                values={distinctValues.totalQuantity ?? []}
                selected={Array.from(filters["totalQuantity"] ?? [])}
                onApply={(v) => applyColumn("totalQuantity", v)}
              />
              <ColumnFilterHeader
                label="Serial No."
                values={distinctValues.serialNumber ?? []}
                selected={Array.from(filters["serialNumber"] ?? [])}
                onApply={(v) => applyColumn("serialNumber", v)}
              />
              <ColumnFilterHeader
                label="DC #"
                values={distinctValues.dcNumber ?? []}
                selected={Array.from(filters["dcNumber"] ?? [])}
                onApply={(v) => applyColumn("dcNumber", v)}
              />
              <ColumnFilterHeader
                label="E-Way Bill"
                values={distinctValues.ewayBill ?? []}
                selected={Array.from(filters["ewayBill"] ?? [])}
                onApply={(v) => applyColumn("ewayBill", v)}
              />
              <ColumnFilterHeader
                label="Status"
                values={distinctValues.status ?? []}
                selected={Array.from(filters["status"] ?? [])}
                onApply={(v) => applyColumn("status", v)}
              />
              {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            <ScrollToItem selectedId={selectedId} prefix="finance" />
            {filteredOrders.map((order) => (
              <FinanceOrderRow key={order.id} order={order} canManage={canManage} elementId={`finance-${order.id}`} financeSubTab={financeSubTab} />
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                  No results match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
