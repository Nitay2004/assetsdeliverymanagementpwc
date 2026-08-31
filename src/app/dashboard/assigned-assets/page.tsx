import { prisma } from "@/lib/prisma";
import { Users, Laptop, MapPin } from "lucide-react";
import { AssignedAssetsTable } from "@/components/assigned-assets/assigned-assets-table";
import { AssignedAssetsExportButton } from "@/components/assigned-assets/assigned-assets-export-button";
import { parseColumnFilters, computeDistinctValues } from "@/lib/column-filters";
import type { Prisma } from "@prisma/client";

const ASSIGNED_FILTER_KEYS = ["serialNumber", "model", "employeeName", "emailId", "purpose", "trackingStatus", "location"];

function safeISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  const t = date.getTime();
  return isNaN(t) ? null : date.toISOString();
}

export default async function AssignedAssetsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const selectedId =
    typeof searchParams.selected === "string"
      ? searchParams.selected
      : undefined;

  const page = Math.max(1, parseInt(searchParams.page as string) || 1);
  const pageSize = Math.max(
    1,
    Math.min(100, parseInt(searchParams.limit as string) || 25)
  );
  const skip = (page - 1) * pageSize;
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";

  const baseWhere: Prisma.InventoryItemWhereInput = { status: "ALLOCATED" };
  const where: Prisma.InventoryItemWhereInput = search
    ? {
        ...baseWhere,
        OR: [
          { serialNumber: { contains: search, mode: "insensitive" } },
          { model: { contains: search, mode: "insensitive" } },
          { employeeName: { contains: search, mode: "insensitive" } },
          { emailId: { contains: search, mode: "insensitive" } },
          { purpose: { contains: search, mode: "insensitive" } },
          { trackingStatus: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { state: { contains: search, mode: "insensitive" } },
          { partner: { contains: search, mode: "insensitive" } },
        ],
      }
    : baseWhere;

  const columnFilters = parseColumnFilters(searchParams, ASSIGNED_FILTER_KEYS);
  if (columnFilters.serialNumber) where.serialNumber = { in: columnFilters.serialNumber };
  if (columnFilters.model) where.model = { in: columnFilters.model };
  if (columnFilters.employeeName) where.employeeName = { in: columnFilters.employeeName };
  if (columnFilters.emailId) where.emailId = { in: columnFilters.emailId };
  if (columnFilters.purpose) where.purpose = { in: columnFilters.purpose };
  if (columnFilters.trackingStatus) where.trackingStatus = { in: columnFilters.trackingStatus };

  if (columnFilters.location) {
    where.OR = [
      { city: { in: columnFilters.location } },
      { state: { in: columnFilters.location } },
    ];
  }

  const [items, totalCount, uniqueEmployees, modelBreakdown] =
    await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: {
          assignmentRecords: {
            orderBy: { assignedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.inventoryItem.count({ where }),
      prisma.inventoryItem.findMany({
        where: { status: "ALLOCATED" },
        select: { employeeName: true },
        distinct: ["employeeName"],
      }),
      prisma.inventoryItem.groupBy({
        by: ["model"],
        where: { status: "ALLOCATED" },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

  const distinctSource = await prisma.inventoryItem.findMany({
    where,
    select: {
      serialNumber: true, model: true, employeeName: true, emailId: true, purpose: true,
      trackingStatus: true, city: true, state: true,
      assignmentRecords: { orderBy: { assignedAt: "desc" }, take: 1, select: { employeeName: true, emailId: true, purpose: true } },
    },
  });
  const columnFilterValues = computeDistinctValues(distinctSource, {
    serialNumber: r => r.serialNumber,
    model: r => r.model,
    employeeName: r => r.assignmentRecords[0]?.employeeName ?? r.employeeName,
    emailId: r => r.assignmentRecords[0]?.emailId ?? r.emailId,
    purpose: r => r.assignmentRecords[0]?.purpose ?? r.purpose,
    trackingStatus: r => r.trackingStatus,
    location: r => [r.city, r.state].filter(Boolean).join(", "),
  });

  const uniqueEmployeeCount = uniqueEmployees.filter(
    (e) => e.employeeName !== null
  ).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Assigned Assets
          </h1>
          <p className="text-muted-foreground mt-2">
            All inventory items currently allocated to users.
          </p>
        </div>
        <AssignedAssetsExportButton />
      </div>

      <div className="grid gap-6 sm:grid-cols-3 mt-8">
        <div className="p-6 rounded-xl glass shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
            <Laptop className="size-4" />
            Total Allocated
          </div>
          <p className="text-3xl font-bold text-blue-600">{totalCount}</p>
        </div>
        <div className="p-6 rounded-xl glass shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
            <Users className="size-4" />
            Unique Employees
          </div>
          <p className="text-3xl font-bold text-primary">{uniqueEmployeeCount}</p>
        </div>
        <div className="p-6 rounded-xl glass shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
            <MapPin className="size-4" />
            Top Model
          </div>
          <p className="text-3xl font-bold text-primary truncate">
            {modelBreakdown[0]?.model || "—"}
          </p>
          {modelBreakdown[0] && (
            <p className="text-xs text-muted-foreground">
              {modelBreakdown[0]._count.id} unit(s)
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl glass shadow-sm mt-6 overflow-hidden">
        <div className="p-6 border-b flex items-center gap-2 bg-muted/20 border-b-black/5 dark:border-b-white/5">
          <Users className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">Allocated Inventory</h2>
        </div>
        <AssignedAssetsTable
          selectedId={selectedId}
          totalCount={totalCount}
          currentPage={page}
          pageSize={pageSize}
          columnFilterValues={columnFilterValues}
          items={items.map((i) => {
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
              _latestAssignment: latest
                ? {
                    employeeName: latest.employeeName,
                    emailId: latest.emailId,
                    purpose: latest.purpose,
                    requestDate: safeISO(latest.requestDate),
                    mobileNumber: latest.mobileNumber,
                  }
                : null,
            };
          })}
        />
      </div>
    </div>
  );
}
