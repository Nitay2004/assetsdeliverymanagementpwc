import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { FileText, CheckCircle } from "lucide-react";
import { FinanceOrderRow } from "@/components/finance/finance-order-row";
import { ScrollToItem } from "@/components/shared/scroll-to-item";

export default async function FinancePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "FINANCE"));

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["IN_PROVISIONING", "DC_GENERATED", "DISPATCHED", "DELIVERED", "DELIVERY_CONFIRMED", "INVOICED", "PAYMENT_RECEIVED"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  const pendingDC = orders.filter(o => o.status === "IN_PROVISIONING").length;
  const invoiced = orders.filter(o => o.status === "INVOICED" || o.status === "PAYMENT_RECEIVED").length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Finance Module</h1>
        <p className="text-muted-foreground mt-2">
          Generate Delivery Challans and Invoices for orders.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-100">
            <FileText className="size-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Pending DC</p>
            <p className="text-2xl font-bold text-primary mt-1">{pendingDC}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-100">
            <CheckCircle className="size-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Invoiced</p>
            <p className="text-2xl font-bold text-primary mt-1">{invoiced}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100">
            <FileText className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Orders</p>
            <p className="text-2xl font-bold text-primary mt-1">{orders.length}</p>
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="p-8 rounded-xl glass text-center text-muted-foreground">
          No orders ready for finance processing.
        </div>
      ) : (
        <div className="rounded-xl glass shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Location</th>
                  <th className="px-6 py-4 font-semibold">Units</th>
                  <th className="px-6 py-4 font-semibold">DC #</th>
                  <th className="px-6 py-4 font-semibold">Invoice #</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                <ScrollToItem selectedId={selectedId} prefix="finance" />
                {orders.map((order) => (
                  <FinanceOrderRow key={order.id} order={order} canManage={canManage} elementId={`finance-${order.id}`} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
