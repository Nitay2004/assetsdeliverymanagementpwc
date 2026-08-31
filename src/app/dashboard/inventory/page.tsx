import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Package, ShieldCheck, Laptop, Database, ClipboardCheck } from "lucide-react";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryHeader } from "@/components/inventory/inventory-header";
import { parseColumnFilters, computeDistinctValues } from "@/lib/column-filters";
import type { Prisma, InventoryStatus } from "@prisma/client";

const INVENTORY_FILTER_KEYS = ["serialNumber", "model", "status", "invoicingWarehouse", "employeeName", "trackingStatus"];

function safeISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  const t = date.getTime();
  return isNaN(t) ? null : date.toISOString();
}

export default async function InventoryPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;

  const user = await getSession();
  const isAdmin = user?.role === "ADMIN";

  const page = Math.max(1, parseInt(searchParams.page as string) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.limit as string) || 25));
  const skip = (page - 1) * pageSize;
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
  const columnFilters = parseColumnFilters(searchParams, INVENTORY_FILTER_KEYS);

  const baseWhere: Prisma.InventoryItemWhereInput = {};
  const where: Prisma.InventoryItemWhereInput = search ? {
    ...baseWhere,
    OR: [
      { serialNumber: { contains: search, mode: "insensitive" as const } },
      { model: { contains: search, mode: "insensitive" as const } },
      { invoicingWarehouse: { contains: search, mode: "insensitive" as const } },
      { trackingStatus: { contains: search, mode: "insensitive" as const } },
      { employeeName: { contains: search, mode: "insensitive" as const } },
    ],
  } : baseWhere;

  if (columnFilters.serialNumber) where.serialNumber = { in: columnFilters.serialNumber };
  if (columnFilters.model) where.model = { in: columnFilters.model };
  if (columnFilters.status) where.status = { in: columnFilters.status as InventoryStatus[] };
  if (columnFilters.invoicingWarehouse) where.invoicingWarehouse = { in: columnFilters.invoicingWarehouse };
  if (columnFilters.employeeName) where.employeeName = { in: columnFilters.employeeName };
  if (columnFilters.trackingStatus) where.trackingStatus = { in: columnFilters.trackingStatus };

  const [inventoryItems, totalCount, newCount, availableCount, allocatedCount, qcPendingCount] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
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
    prisma.inventoryItem.count({ where }),
    prisma.inventoryItem.count({ where: { status: "NEW" } }),
    prisma.inventoryItem.count({ where: { status: "AVAILABLE" } }),
    prisma.inventoryItem.count({ where: { status: "ALLOCATED" } }),
    prisma.inventoryItem.count({ where: { status: "QC_PENDING" } }),
  ]);

  const distinctSource = await prisma.inventoryItem.findMany({
    where,
    select: { serialNumber: true, model: true, status: true, invoicingWarehouse: true, employeeName: true, trackingStatus: true },
  });
  const columnFilterValues = computeDistinctValues(distinctSource, {
    serialNumber: r => r.serialNumber,
    model: r => r.model,
    status: r => r.status,
    invoicingWarehouse: r => r.invoicingWarehouse,
    employeeName: r => r.employeeName,
    trackingStatus: r => r.trackingStatus,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Inventory Module</h1>
        <p className="text-muted-foreground mt-2">
          Manage and monitor all physical laptop stock in the warehouse.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-5 mt-8">
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
            <ClipboardCheck className="size-4" />
            QC Pending
          </div>
          <p className="text-3xl font-bold text-amber-600">{qcPendingCount}</p>
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
          columnFilterValues={columnFilterValues}
          items={inventoryItems.map(i => {
          const latest = i.assignmentRecords[0];
          return {
            ...i,
            requestDate: safeISO(i.requestDate),
            slaStartDate: safeISO(i.slaStartDate),
            actualDeliveryDate: safeISO(i.actualDeliveryDate),
            laptopAcceptanceDate: safeISO(i.laptopAcceptanceDate),
            warrantyEndPeriod: safeISO(i.warrantyEndPeriod),
            deliveryDate: safeISO(i.deliveryDate),
            pickupDate: safeISO(i.pickupDate),
            dateOfWs1Update: safeISO(i.dateOfWs1Update),
            servicesStartDate: safeISO(i.servicesStartDate),
            date: safeISO(i.date),
            createdAt: safeISO(i.createdAt),
            updatedAt: safeISO(i.updatedAt),
            _latestAssignment: latest ? {
              employeeName: latest.employeeName,
              emailId: latest.emailId,
              purpose: latest.purpose,
              requestDate: safeISO(latest.requestDate),
              mobileNumber: latest.mobileNumber,
            } : null,
          };
        })} />
      </div>
    </div>
  );
}
