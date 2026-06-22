import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Package, Truck, ClipboardList } from "lucide-react";
import { LogisticsTable } from "@/components/logistics/logistics-table";

export default async function LogisticsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "LOGISTICS"));

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["DC_GENERATED", "PACKED_AND_LABELLED", "DOCKET_ASSIGNED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED", "DISPATCHED", "DELIVERED"] },
    },
    include: {
      dockets: { orderBy: { createdAt: "desc" } },
      assets: { include: { inventoryItem: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const pendingPacking = orders.filter(o => o.status === "DC_GENERATED").length;
  const inTransit = orders.filter(o => ["DISPATCHED", "DELIVERED"].includes(o.status)).length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Logistics Module</h1>
        <p className="text-muted-foreground mt-2">
          Manage packing, docketing, E-Way bills, and delivery tracking.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-100">
            <Package className="size-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Pending Packing</p>
            <p className="text-2xl font-bold text-primary mt-1">{pendingPacking}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-orange-100">
            <Truck className="size-5 text-orange-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">In Transit</p>
            <p className="text-2xl font-bold text-primary mt-1">{inTransit}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100">
            <ClipboardList className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Orders</p>
            <p className="text-2xl font-bold text-primary mt-1">{orders.length}</p>
          </div>
        </div>
      </div>

      <LogisticsTable orders={orders} canManage={canManage} />
    </div>
  );
}
