import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Package, ShieldCheck, Laptop, Database, Upload, Plus } from "lucide-react";
import Link from "next/link";
import { InventoryTable } from "@/components/inventory/inventory-table";

export default async function InventoryPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;

  const user = await getSession();
  const isAdmin = user?.role === "ADMIN";

  const page = Math.max(1, parseInt(searchParams.page as string) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.limit as string) || 25));
  const skip = (page - 1) * pageSize;

  const [inventoryItems, totalCount, availableCount, allocatedCount] = await Promise.all([
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

      <div className="grid gap-6 sm:grid-cols-3 mt-8">
        <div className="p-6 rounded-xl glass shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
            <Package className="size-4" />
            Total Stock
          </div>
          <p className="text-3xl font-bold text-primary">{totalCount}</p>
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
        <div className="p-6 border-b flex items-center gap-2 bg-muted/20 border-b-black/5 dark:border-b-white/5">
          <Database className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">Inventory Pool</h2>
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/dashboard/inventory/add"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px"
              >
                <Plus className="size-3.5" />
                Add Item
              </Link>
            )}
            <Link
              href="/dashboard/inventory/import"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px"
            >
              <Upload className="size-3.5" />
              Import CSV
            </Link>
          </div>
        </div>
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
