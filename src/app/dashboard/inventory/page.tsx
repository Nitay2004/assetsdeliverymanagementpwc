import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryHeader } from "@/components/inventory/inventory-header";
import { InventoryStatCards } from "@/components/inventory/inventory-stat-cards";
import { parseColumnFilters } from "@/lib/column-filters";
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

  const colGroups = await Promise.all([
    prisma.inventoryItem.groupBy({ by: ["serialNumber"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["model"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["invoicingWarehouse"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["employeeName"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["trackingStatus"], where, _count: { _all: true } }),
  ]);
  const sortByValue = (a: { value: string }, b: { value: string }) => a.value.localeCompare(b.value);
  const columnFilterValues = {
    serialNumber: colGroups[0].map((r) => ({ value: r.serialNumber, count: r._count._all })).sort(sortByValue),
    model: colGroups[1].map((r) => ({ value: r.model, count: r._count._all })).sort(sortByValue),
    status: colGroups[2].map((r) => ({ value: r.status, count: r._count._all })).sort(sortByValue),
    invoicingWarehouse: colGroups[3].map((r) => ({ value: r.invoicingWarehouse?.trim() ? r.invoicingWarehouse : "(Blank)", count: r._count._all })).sort(sortByValue),
    employeeName: colGroups[4].map((r) => ({ value: r.employeeName?.trim() ? r.employeeName : "(Blank)", count: r._count._all })).sort(sortByValue),
    trackingStatus: colGroups[5].map((r) => ({ value: r.trackingStatus?.trim() ? r.trackingStatus : "(Blank)", count: r._count._all })).sort(sortByValue),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Inventory Module</h1>
        <p className="text-muted-foreground mt-2">
          Manage and monitor all physical laptop stock in the warehouse.
        </p>
      </div>

      <InventoryStatCards
        totalCount={totalCount}
        newCount={newCount}
        availableCount={availableCount}
        qcPendingCount={qcPendingCount}
        allocatedCount={allocatedCount}
      />

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
            expectedDeliveryDate: safeISO(i.expectedDeliveryDate),
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
