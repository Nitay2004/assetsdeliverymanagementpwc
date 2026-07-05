import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Package, ShieldCheck, Laptop, Database } from "lucide-react";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryHeader } from "@/components/inventory/inventory-header";

export default async function InventoryPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;

  const user = await getSession();
  const isAdmin = user?.role === "ADMIN";

  const page = Math.max(1, parseInt(searchParams.page as string) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.limit as string) || 25));
  const skip = (page - 1) * pageSize;

  const [inventoryItems, totalCount, newCount, availableCount, allocatedCount] = await Promise.all([
    prisma.inventoryItem.findMany({
      skip,
      take: pageSize,
      include: {
        assignmentRecords: {
          orderBy: { assignedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventoryItem.count(),
    prisma.inventoryItem.count({ where: { status: "NEW" } }),
    prisma.inventoryItem.count({ where: { status: "AVAILABLE" } }),
    prisma.inventoryItem.count({ where: { status: "ALLOCATED" } }),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Inventory Module</h1>
        <p className="text-muted-foreground mt-2">
          Manage and monitor all physical laptop stock in the warehouse.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-4 mt-8">
        <div className="p-6 rounded-xl glass shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
            <Package className="size-4" />
            Total Stock
          </div>
          <p className="text-3xl font-bold text-primary">{totalCount}</p>
        </div>
        <div className="p-6 rounded-xl glass shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
            <Database className="size-4" />
            New
          </div>
          <p className="text-3xl font-bold text-purple-600">{newCount}</p>
        </div>
        <div className="p-6 rounded-xl glass shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
            <ShieldCheck className="size-4" />
            Available
          </div>
          <p className="text-3xl font-bold text-primary">{availableCount}</p>
        </div>
        <div className="p-6 rounded-xl glass shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
            <Laptop className="size-4" />
            Allocated
          </div>
          <p className="text-3xl font-bold text-primary">{allocatedCount}</p>
        </div>
      </div>

      <div className="rounded-xl glass shadow-sm mt-6 overflow-hidden">
        <InventoryHeader isAdmin={isAdmin} />
        <InventoryTable
          isAdmin={isAdmin}
          selectedId={selectedId}
          totalCount={totalCount}
          currentPage={page}
          pageSize={pageSize}
          items={inventoryItems.map(i => {
          const latest = i.assignmentRecords[0];
          return {
            ...i,
            requestDate: i.requestDate ?? null,
            slaStartDate: i.slaStartDate ?? null,
            actualDeliveryDate: i.actualDeliveryDate ?? null,
            laptopAcceptanceDate: i.laptopAcceptanceDate ?? null,
            warrantyEndPeriod: i.warrantyEndPeriod ?? null,
            deliveryDate: i.deliveryDate ?? null,
            pickupDate: i.pickupDate ?? null,
            dateOfWs1Update: i.dateOfWs1Update ?? null,
            servicesStartDate: i.servicesStartDate ?? null,
            date: i.date ?? null,
            _latestAssignment: latest ? {
              employeeName: latest.employeeName,
              emailId: latest.emailId,
              purpose: latest.purpose,
              requestDate: latest.requestDate?.toISOString() ?? null,
              mobileNumber: latest.mobileNumber,
            } : null,
          };
        })} />
      </div>
    </div>
  );
}
