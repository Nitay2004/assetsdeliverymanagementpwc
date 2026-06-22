import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Plus, Package, Clock, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { PendingAllocationsTable } from "@/components/warehouse/pending-allocations-table";
import { OrderActions } from "@/components/orders/order-actions";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ORDER_PLACED:     { label: "Order Placed",     color: "bg-yellow-100 text-yellow-700" },
  ALLOCATED:        { label: "Allocated",         color: "bg-blue-100 text-blue-700" },
  IN_PROVISIONING:  { label: "In Provisioning",  color: "bg-purple-100 text-purple-700" },
  DC_GENERATED:     { label: "DC Generated",     color: "bg-indigo-100 text-indigo-700" },
  DISPATCHED:       { label: "Dispatched",       color: "bg-orange-100 text-orange-700" },
  DELIVERED:        { label: "Delivered",        color: "bg-green-100 text-green-700" },
};

export default async function WarehousePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "WAREHOUSE"));

  const orders = await prisma.order.findMany({
    include: {
      assets: {
        include: { inventoryItem: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const availableInventory = await prisma.inventoryItem.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { serialNumber: "asc" },
  });

  const pendingOrders = orders.filter((o) => o.status === "ORDER_PLACED");
  const allocatedOrders = orders.filter((o) => o.status !== "ORDER_PLACED");

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Warehouse Module</h1>
          <p className="text-muted-foreground mt-2">
            Allocate laptops from inventory to pending orders.
          </p>
        </div>
        {canManage && (
          <Link
            href="/dashboard/warehouse/add"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-press"
          >
            <Plus className="size-4" />
            Add Order
          </Link>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-100">
            <Clock className="size-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Pending Allocation</p>
            <p className="text-2xl font-bold text-primary mt-1">{pendingOrders.length}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100">
            <Package className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Available Stock</p>
            <p className="text-2xl font-bold text-primary mt-1">{availableInventory.length}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-100">
            <CheckCircle className="size-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Allocated Assets</p>
            <p className="text-2xl font-bold text-primary mt-1">{allocatedOrders.length}</p>
          </div>
        </div>
      </div>

      {/* Pending Orders — Allocation required */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <AlertCircle className="size-5 text-yellow-500" />
          Pending Allocation
        </h2>

        <PendingAllocationsTable
          orders={pendingOrders}
          availableItems={availableInventory}
          canManage={canManage}
        />
      </div>

      {/* Allocated Assets */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <CheckCircle className="size-5 text-green-500" />
          Allocated Assets
        </h2>

        <div className="rounded-xl glass shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Location</th>
                  <th className="px-6 py-4 font-semibold">Units</th>
                  <th className="px-6 py-4 font-semibold">Serial Numbers Assigned</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {allocatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="px-6 py-8 text-center text-muted-foreground">
                      No allocated assets yet.
                    </td>
                  </tr>
                ) : (
                  allocatedOrders.map((order) => (
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
        </div>
      </div>
    </div>
  );
}
