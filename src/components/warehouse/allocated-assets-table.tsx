"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OrderActions } from "@/components/orders/order-actions";
import { UrlDataTableFilter } from "@/components/shared/data-table-filter";

interface AssetInventoryItem {
  id: string;
  serialNumber: string | null;
}

interface Asset {
  id: string;
  inventoryItem: AssetInventoryItem | null;
}

interface Docket {
  id: string;
  docketNumber: string | null;
  ewayBillNumber: string | null;
}

interface Order {
  id: string;
  clientName: string;
  deliveryLocation: string;
  totalQuantity: number;
  status: string;
  dcNumber: string | null;
  assets: Asset[];
  dockets: Docket[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ORDER_PLACED:     { label: "Order Placed",     color: "bg-yellow-100 text-yellow-700" },
  ALLOCATED:        { label: "Allocated",         color: "bg-blue-100 text-blue-700" },
  IN_PROVISIONING:  { label: "In Provisioning",  color: "bg-purple-100 text-purple-700" },
  DC_GENERATED:     { label: "DC Generated",     color: "bg-indigo-100 text-indigo-700" },
  DISPATCHED:       { label: "Dispatched",       color: "bg-orange-100 text-orange-700" },
  DELIVERED:        { label: "Delivered",        color: "bg-green-100 text-green-700" },
};

export function AllocatedAssetsTable({
  orders,
  canManage,
  totalCount,
  currentPage,
  pageSize,
}: {
  orders: Order[];
  canManage: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
}) {
  const router = useRouter();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  function goToPage(page: number) {
    router.push(`/dashboard/warehouse?page=${page}&limit=${pageSize}`);
  }

  const filteredOrders = orders;

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <UrlDataTableFilter placeholder="Search by client, location, serial no, docket, DC..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold">Client</th>
              <th className="px-6 py-4 font-semibold">Location</th>
              <th className="px-6 py-4 font-semibold">Units</th>
              <th className="px-6 py-4 font-semibold">Serial Numbers Assigned</th>
              <th className="px-6 py-4 font-semibold">Docket No</th>
              <th className="px-6 py-4 font-semibold">DC No</th>
              <th className="px-6 py-4 font-semibold">E-Way Bill</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-6 py-8 text-center text-muted-foreground">
                  No allocated assets yet.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} id={`order-${order.id}`} className="hover:bg-muted/10 transition-colors scroll-mt-20">
                  <td className="px-6 py-4 font-medium">{order.clientName}</td>
                  <td className="px-6 py-4 text-muted-foreground">{order.deliveryLocation}</td>
                  <td className="px-6 py-4">{order.totalQuantity}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {order.assets
                        .filter((a) => a.inventoryItem)
                        .map((a) => (
                          <span key={a.id} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-mono">
                            {a.inventoryItem?.serialNumber}
                          </span>
                        ))}
                      {order.assets.filter((a) => !a.inventoryItem).length > 0 && (
                        <span className="text-xs text-muted-foreground italic">
                          {order.assets.filter((a) => !a.inventoryItem).length} unassigned
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                    {order.dockets?.[0]?.docketNumber || "—"}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                    {order.dcNumber || "—"}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                    {order.dockets?.[0]?.ewayBillNumber || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_LABELS[order.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[order.status]?.label ?? order.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-6 py-4">
                      <OrderActions orderId={order.id} />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => { router.push(`/dashboard/warehouse?page=1&limit=${e.target.value}`); }}
            className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {[10, 25, 50, 100].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>
            {totalCount === 0 ? "0 items" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalCount)} of ${totalCount}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-3 text-sm text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          <button
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
