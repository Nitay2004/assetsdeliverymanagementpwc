"use client";

import { FinanceOrderRow } from "@/components/finance/finance-order-row";
import { ScrollToItem } from "@/components/shared/scroll-to-item";
import { UrlDataTableFilter } from "@/components/shared/data-table-filter";

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
}

export function FinanceOrderTable({ orders, canManage, selectedId }: Props) {
  const filteredOrders = orders;

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <UrlDataTableFilter placeholder="Search by client, location, serial no, DC, invoice..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold">Client</th>
              <th className="px-6 py-4 font-semibold">Location</th>
              <th className="px-6 py-4 font-semibold">Units</th>
              <th className="px-6 py-4 font-semibold">Serial No.</th>
              <th className="px-6 py-4 font-semibold">DC #</th>
              <th className="px-6 py-4 font-semibold">E-Way Bill</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            <ScrollToItem selectedId={selectedId} prefix="finance" />
            {filteredOrders.map((order) => (
              <FinanceOrderRow key={order.id} order={order} canManage={canManage} elementId={`finance-${order.id}`} />
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                  {filteredOrders.length === 0 ? "No results match your search." : "No orders found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
