import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CheckCircle, Clock, Wrench, User } from "lucide-react";
import { ProvisioningTable } from "@/components/provisioning/provisioning-table";
import { ProvisioningPagination } from "@/components/provisioning/provisioning-pagination";
import { ProvisioningExportButton } from "@/components/provisioning/provisioning-export-button";
import type { Prisma } from "@prisma/client";

export default async function ProvisioningPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "25", 10) || 25));
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "PROVISIONING"));

  if (selectedId) {
    const selOrder = await prisma.order.findUnique({
      where: { id: selectedId },
      select: { updatedAt: true, status: true },
    });
    if (selOrder && !["ALLOCATED", "IN_PROVISIONING", "DOCKET_REQUESTED"].includes(selOrder.status)) {
      const pos = await prisma.order.count({
        where: { status: { in: ["ALLOCATED", "IN_PROVISIONING", "DOCKET_REQUESTED"] }, updatedAt: { gt: selOrder.updatedAt } },
      });
      const correctPage = Math.floor(pos / limit) + 1;
      if (correctPage !== page) {
        redirect(`/dashboard/provisioning?page=${correctPage}&limit=${limit}&selected=${selectedId}`);
      }
    }
  }

  const baseWhere: Prisma.OrderWhereInput = { status: { in: ["ALLOCATED", "IN_PROVISIONING", "DOCKET_REQUESTED"] } };
  const where: Prisma.OrderWhereInput = search ? {
    ...baseWhere,
    OR: [
      { clientName: { contains: search, mode: "insensitive" as const } },
      { deliveryLocation: { contains: search, mode: "insensitive" as const } },
      { engineerName: { contains: search, mode: "insensitive" as const } },
      { warehouseLocation: { contains: search, mode: "insensitive" as const } },
      { provisioningLocation: { contains: search, mode: "insensitive" as const } },
      { assets: { some: { inventoryItem: { serialNumber: { contains: search, mode: "insensitive" as const } } } } },
      { assets: { some: { inventoryItem: { model: { contains: search, mode: "insensitive" as const } } } } },
    ],
  } : baseWhere;

  const [totalCount, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        assets: {
          include: { inventoryItem: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const engineers = [...new Set(orders.map(o => o.engineerName).filter(Boolean))] as string[];
  const inProvisioningCount = orders.filter(o => o.status === "ALLOCATED" || o.status === "IN_PROVISIONING").length;
  const handedOverCount = orders.filter(o => o.status === "DOCKET_REQUESTED").length;
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Provisioning Module</h1>
          <p className="text-muted-foreground mt-2">
            Track OS installation and hardware quality checks.
          </p>
        </div>
        <ProvisioningExportButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-100">
            <Clock className="size-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">In Provisioning</p>
            <p className="text-2xl font-bold text-primary mt-1">{inProvisioningCount}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-100">
            <CheckCircle className="size-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Handed Over</p>
            <p className="text-2xl font-bold text-primary mt-1">{handedOverCount}</p>
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
              selectedId={selectedId}
            />
          </section>
        ))
      )}

      <ProvisioningPagination totalCount={totalCount} currentPage={page} pageSize={limit} />
    </div>
  );
}
