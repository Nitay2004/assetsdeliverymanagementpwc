import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CheckCircle, Clock, Wrench, User } from "lucide-react";
import { ProvisioningTable } from "@/components/provisioning/provisioning-table";

export default async function ProvisioningPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "PROVISIONING"));

  const orders = await prisma.order.findMany({
    where: { status: { in: ["ALLOCATED", "IN_PROVISIONING"] } },
    include: {
      assets: {
        include: { inventoryItem: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const engineers = [...new Set(orders.map(o => o.engineerName).filter(Boolean))] as string[];
  const completedCount = orders.filter(o => o.status === "IN_PROVISIONING").length;
  const totalAssets = orders.reduce((sum, o) => sum + o.assets.length, 0);

  // Group data by engineer for sections
  const sections: { label: string; orders: typeof orders }[] = [];

  const unassignedOrders = orders.filter(o => !o.engineerName);
  if (unassignedOrders.length > 0) {
    sections.push({ label: "Unassigned", orders: unassignedOrders });
  }

  for (const eng of engineers) {
    const engOrders = orders.filter(o => o.engineerName === eng);
    if (engOrders.length > 0) {
      sections.push({ label: eng, orders: engOrders });
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Provisioning Module</h1>
        <p className="text-muted-foreground mt-2">
          Track OS installation and hardware quality checks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-100">
            <Clock className="size-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Pending</p>
            <p className="text-2xl font-bold text-primary mt-1">{orders.length - completedCount}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-100">
            <CheckCircle className="size-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">In Provisioning</p>
            <p className="text-2xl font-bold text-primary mt-1">{completedCount}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-100">
            <Wrench className="size-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Assets</p>
            <p className="text-2xl font-bold text-primary mt-1">{totalAssets}</p>
          </div>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="p-8 rounded-xl glass text-center text-muted-foreground">
          No orders ready for provisioning. Allocate inventory in the Warehouse module first.
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.label} className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <User className={`size-5 ${section.label === "Unassigned" ? "text-muted-foreground" : "text-blue-600"}`} />
              {section.label}
              <span className="text-sm font-normal text-muted-foreground">
                — {section.orders.length} order(s), {section.orders.reduce((s, o) => s + o.assets.length, 0)} asset(s)
              </span>
            </h2>
            <ProvisioningTable
              orders={section.orders}
              canManage={canManage}
              engineers={engineers}
            />
          </section>
        ))
      )}
    </div>
  );
}
