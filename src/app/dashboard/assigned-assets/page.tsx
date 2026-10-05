import { prisma } from "@/lib/prisma";
import { Users, Laptop, MapPin } from "lucide-react";
import { AssignedAssetsTable } from "@/components/assigned-assets/assigned-assets-table";
import { AssignedAssetsExportButton } from "@/components/assigned-assets/assigned-assets-export-button";
import { parseColumnFilters, blankTokenConditions, collectBlankTokenConditions, andFilterConditions } from "@/lib/column-filters";
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
  andFilterConditions(where, [
    ...collectBlankTokenConditions(columnFilters, {
      employeeName: "employeeName",
      emailId: "emailId",
      purpose: "purpose",
      trackingStatus: "trackingStatus",
    }),
    // The Location dropdown matches either column, so both are OR-ed inside a
    // single group: "city matches OR state matches".
    ...(columnFilters.location
      ? [{
          OR: [
            ...blankTokenConditions("city", columnFilters.location),
            ...blankTokenConditions("state", columnFilters.location),
          ],
        }]
      : []),
  ]);

  const totalCount = await prisma.inventoryItem.count({ where });

  // Ordered by when each item was assigned rather than by updatedAt. Tracking
  // sync, reverse pickup and DC updates all bump updatedAt, which pushed rows
  // that were never assigned to a person (DC dockets, and items with no employee
  // details) to the top of the list and left the first page looking empty.
  //
  // The grouping runs unpaginated and the page is cut in JS: Prisma applies
  // skip/take before aggregating here, so an item with several assignment
  // records could otherwise land on two pages at once.
  const assignmentRows = await prisma.assignmentRecord.groupBy({
    by: ["inventoryItemId"],
    where: { inventoryItem: where },
    _max: { assignedAt: true },
    orderBy: { _max: { assignedAt: "desc" } },
  });

  const assignmentOrder = new Map(
    assignmentRows
      .slice(skip, skip + pageSize)
      .map((r, idx) => [r.inventoryItemId, idx])
  );

  const items = (
    await prisma.inventoryItem.findMany({
      where: { id: { in: [...assignmentOrder.keys()] } },
      include: {
        assignmentRecords: {
          orderBy: { assignedAt: "desc" },
          take: 1,
        },
      },
    })
  ).sort(
    (a, b) =>
      (assignmentOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (assignmentOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );

  const [uniqueEmployees, modelBreakdown] =
    await Promise.all([
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

  const [serialNumberGroups, modelGroups, trackingStatusGroups, locationGroups, assignmentEmployeeGroups, assignmentEmailGroups, assignmentPurposeGroups, fallbackEmployeeGroups, fallbackEmailGroups, fallbackPurposeGroups] = await Promise.all([
    prisma.inventoryItem.groupBy({ by: ["serialNumber"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["model"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["trackingStatus"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({
      by: ["city", "state"],
      where,
      _count: { _all: true },
    }),
    prisma.assignmentRecord.groupBy({
      by: ["employeeName"],
      where: { inventoryItem: where },
      _count: { _all: true },
    }),
    prisma.assignmentRecord.groupBy({
      by: ["emailId"],
      where: { inventoryItem: where },
      _count: { _all: true },
    }),
    prisma.assignmentRecord.groupBy({
      by: ["purpose"],
      where: { inventoryItem: where },
      _count: { _all: true },
    }),
    prisma.inventoryItem.groupBy({
      by: ["employeeName"],
      where: { ...where, assignmentRecords: { none: {} } },
      _count: { _all: true },
    }),
    prisma.inventoryItem.groupBy({
      by: ["emailId"],
      where: { ...where, assignmentRecords: { none: {} } },
      _count: { _all: true },
    }),
    prisma.inventoryItem.groupBy({
      by: ["purpose"],
      where: { ...where, assignmentRecords: { none: {} } },
      _count: { _all: true },
    }),
  ]);

  const columnFilterValues: Record<string, { value: string; count: number }[]> = {};
  columnFilterValues.serialNumber = serialNumberGroups
    .map(r => ({ value: r.serialNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.model = modelGroups
    .map(r => ({ value: r.model ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.trackingStatus = trackingStatusGroups
    .map(r => ({ value: r.trackingStatus ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const locationMap = new Map<string, number>();
  for (const r of locationGroups) {
    const token = [r.city, r.state].filter(t => t !== null && String(t).trim() !== "").join(", ");
    locationMap.set(token || "(Blank)", (locationMap.get(token || "(Blank)") ?? 0) + r._count._all);
  }
  columnFilterValues.location = [...locationMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const mergeRelationChips = <T extends { _count: { _all: number }; [k: string]: unknown }>(
    primary: T[],
    fallback: T[],
    key: string
  ) => {
    const counts = new Map<string, number>();
    for (const g of [...primary, ...fallback]) {
      const raw = g[key];
      const token = raw == null || String(raw).trim() === "" ? "(Blank)" : String(raw);
      counts.set(token, (counts.get(token) ?? 0) + g._count._all);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  };

  columnFilterValues.employeeName = mergeRelationChips(assignmentEmployeeGroups, fallbackEmployeeGroups, "employeeName");
  columnFilterValues.emailId = mergeRelationChips(assignmentEmailGroups, fallbackEmailGroups, "emailId");
  columnFilterValues.purpose = mergeRelationChips(assignmentPurposeGroups, fallbackPurposeGroups, "purpose");

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
