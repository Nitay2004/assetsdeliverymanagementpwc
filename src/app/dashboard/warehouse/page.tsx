import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Plus, Package, Clock, CheckCircle, AlertCircle, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { PendingAllocationsTable } from "@/components/warehouse/pending-allocations-table";
import { AllocatedAssetsTable } from "@/components/warehouse/allocated-assets-table";
import { QcPendingTable } from "@/components/warehouse/qc-pending-table";
import { WarehouseExportButton } from "@/components/warehouse/warehouse-export-button";
import { WarehouseTabs } from "@/components/warehouse/warehouse-tabs";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { parseColumnFilters, blankTokenConditions, collectBlankTokenConditions, andFilterConditions } from "@/lib/column-filters";
import type { Prisma, OrderStatus } from "@prisma/client";

const ALLOCATED_FILTER_KEYS = ["clientName", "deliveryLocation", "totalQuantity", "serialNumbers", "docketNumber", "dcNumber", "ewayBill", "status"];
// The QC tab keeps its own keys; none of them collide with the allocation
// table's params, so the two sub-tabs never filter each other.
const QC_FILTER_KEYS = ["serialNumber", "model", "employeeName", "qcEngineer", "qcCleanResult", "qcPurgeResult"];

function safeISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  const t = date.getTime();
  return isNaN(t) ? null : date.toISOString();
}

export default async function WarehousePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "10", 10) || 10));
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
  const activeTab = typeof searchParams.tab === "string" && searchParams.tab === "qc" ? "qc" : "provisioning";
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "WAREHOUSE"));

  const allocatedWhere: Prisma.OrderWhereInput = { status: { not: "ORDER_PLACED" }, ...(search ? {
    OR: [
      { clientName: { contains: search, mode: "insensitive" as const } },
      { deliveryLocation: { contains: search, mode: "insensitive" as const } },
      { dcNumber: { contains: search, mode: "insensitive" as const } },
      { assets: { some: { inventoryItem: { serialNumber: { contains: search, mode: "insensitive" as const } } } } },
      { dockets: { some: { docketNumber: { contains: search, mode: "insensitive" as const } } } },
      { dockets: { some: { ewayBillNumber: { contains: search, mode: "insensitive" as const } } } },
    ],
  } : {}) };

  const columnFilters = parseColumnFilters(searchParams, ALLOCATED_FILTER_KEYS);
  if (columnFilters.serialNumbers) allocatedWhere.assets = { some: { inventoryItem: { serialNumber: { in: columnFilters.serialNumbers } } } };
  const docketFilters: Prisma.DocketWhereInput[] = [];
  if (columnFilters.docketNumber) docketFilters.push({ OR: blankTokenConditions("docketNumber", columnFilters.docketNumber) });
  if (columnFilters.ewayBill) docketFilters.push({ OR: blankTokenConditions("ewayBillNumber", columnFilters.ewayBill) });
  if (docketFilters.length) allocatedWhere.dockets = { some: { AND: docketFilters } };
  if (columnFilters.clientName) allocatedWhere.clientName = { in: columnFilters.clientName };
  if (columnFilters.deliveryLocation) allocatedWhere.deliveryLocation = { in: columnFilters.deliveryLocation };
  if (columnFilters.status) allocatedWhere.status = { in: columnFilters.status as OrderStatus[] };
  if (columnFilters.totalQuantity) allocatedWhere.totalQuantity = { in: columnFilters.totalQuantity.map(Number) };
  andFilterConditions(allocatedWhere, collectBlankTokenConditions(columnFilters, { dcNumber: "dcNumber" }));

  const qcFilters = parseColumnFilters(searchParams, QC_FILTER_KEYS);
  const qcWhere: Prisma.InventoryItemWhereInput = {
    OR: [{ status: "QC_PENDING" }, { qcCompletedAt: { not: null } }],
    ...(qcFilters.serialNumber ? { serialNumber: { in: qcFilters.serialNumber } } : {}),
    ...(qcFilters.model ? { model: { in: qcFilters.model } } : {}),
    ...(qcFilters.employeeName ? { employeeName: { in: qcFilters.employeeName } } : {}),
    ...(qcFilters.qcEngineer ? { qcEngineer: { in: qcFilters.qcEngineer } } : {}),
    ...(qcFilters.qcCleanResult ? { qcCleanResult: { in: qcFilters.qcCleanResult } } : {}),
    ...(qcFilters.qcPurgeResult ? { qcPurgeResult: { in: qcFilters.qcPurgeResult } } : {}),
  };

  const [pendingOrders, totalAllocated, allocatedOrders, availableInventory] = await Promise.all([
    prisma.order.findMany({
      where: { status: "ORDER_PLACED" },
      include: {
        assets: {
          include: { inventoryItem: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }),
    prisma.order.count({ where: allocatedWhere }),
    prisma.order.findMany({
      where: allocatedWhere,
      include: {
        assets: {
          include: { inventoryItem: true },
        },
        dockets: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.inventoryItem.findMany({
      where: { status: "AVAILABLE" },
      orderBy: [{ serialNumber: "asc" }, { id: "asc" }],
    }),
  ]);

  // QC is its own paged queue now, so the total is counted up front and the
  // rows are sliced rather than loading the whole assignment list.
  const qcTotalCount = await prisma.inventoryItem.count({ where: qcWhere });
  const qcTotalPages = Math.max(1, Math.ceil(qcTotalCount / limit));
  const safeQcPage = Math.min(page, qcTotalPages);

  const [qcPendingItems, qcSerialGroups, qcModelGroups, qcEmployeeGroups, qcEngineerGroups, qcCleanGroups, qcPurgeGroups, qcPendingCount] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: qcWhere,
      orderBy: [{ qcRequestedAt: "desc" }, { id: "desc" }],
      skip: (safeQcPage - 1) * limit,
      take: limit,
    }),
    prisma.inventoryItem.groupBy({ by: ["serialNumber"], where: qcWhere, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["model"], where: qcWhere, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["employeeName"], where: qcWhere, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["qcEngineer"], where: qcWhere, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["qcCleanResult"], where: qcWhere, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["qcPurgeResult"], where: qcWhere, _count: { _all: true } }),
    prisma.inventoryItem.count({ where: { status: "QC_PENDING", qcCompletedAt: null } }),
  ]);

  const qcColumnFilterValues: Record<string, { value: string; count: number }[]> = {
    serialNumber: qcSerialGroups.map(r => ({ value: r.serialNumber ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    model: qcModelGroups.map(r => ({ value: r.model ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    employeeName: qcEmployeeGroups.map(r => ({ value: r.employeeName ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    qcEngineer: qcEngineerGroups.map(r => ({ value: r.qcEngineer ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    qcCleanResult: qcCleanGroups.map(r => ({ value: r.qcCleanResult ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    qcPurgeResult: qcPurgeGroups.map(r => ({ value: r.qcPurgeResult ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
  };

  const serializedQc = qcPendingItems.map(i => ({
    id: i.id,
    serialNumber: i.serialNumber,
    model: i.model,
    status: i.status,
    employeeName: i.employeeName,
    emailId: i.emailId,
    mobileNumber: i.mobileNumber,
    city: i.city,
    state: i.state,
    invoicingWarehouse: i.invoicingWarehouse,
    qcLocation: i.qcLocation,
    qcRequestedAt: safeISO(i.qcRequestedAt),
    qcEngineer: i.qcEngineer,
    qcAssignedAt: safeISO(i.qcAssignedAt),
    qcCleanResult: i.qcCleanResult,
    qcCleanRemarks: i.qcCleanRemarks,
    qcCleanDate: safeISO(i.qcCleanDate),
    qcCleanBy: i.qcCleanBy,
    qcPurgeResult: i.qcPurgeResult,
    qcPurgeRemarks: i.qcPurgeRemarks,
    qcPurgeDate: safeISO(i.qcPurgeDate),
    qcPurgeBy: i.qcPurgeBy,
    qcFinalResult: i.qcFinalResult,
    qcCompletedAt: safeISO(i.qcCompletedAt),
  }));

  const [clientNameGroups, deliveryLocationGroups, totalQuantityGroups, dcNumberGroups, statusGroups, allocatedSerialGroups, allocatedDocketGroups, allocatedEwayGroups] = await Promise.all([
    prisma.order.groupBy({ by: ["clientName"], where: allocatedWhere, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["deliveryLocation"], where: allocatedWhere, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["totalQuantity"], where: allocatedWhere, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["dcNumber"], where: allocatedWhere, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["status"], where: allocatedWhere, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({
      by: ["serialNumber"],
      where: { assets: { some: { order: allocatedWhere } } },
      _count: { _all: true },
    }),
    prisma.docket.groupBy({
      by: ["docketNumber"],
      where: { order: allocatedWhere },
      _count: { _all: true },
    }),
    prisma.docket.groupBy({
      by: ["ewayBillNumber"],
      where: { order: allocatedWhere },
      _count: { _all: true },
    }),
  ]);

  const allocatedColumnFilterValues: Record<string, { value: string; count: number }[]> = {};
  allocatedColumnFilterValues.clientName = clientNameGroups
    .map(r => ({ value: r.clientName ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  allocatedColumnFilterValues.deliveryLocation = deliveryLocationGroups
    .map(r => ({ value: r.deliveryLocation ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  allocatedColumnFilterValues.totalQuantity = totalQuantityGroups
    .map(r => ({ value: r.totalQuantity == null || String(r.totalQuantity).trim() === "" ? "(Blank)" : String(r.totalQuantity), count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  allocatedColumnFilterValues.dcNumber = dcNumberGroups
    .map(r => ({ value: r.dcNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  allocatedColumnFilterValues.status = statusGroups
    .map(r => ({ value: r.status ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  allocatedColumnFilterValues.serialNumbers = allocatedSerialGroups
    .map(r => ({ value: r.serialNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  allocatedColumnFilterValues.docketNumber = allocatedDocketGroups
    .map(r => ({ value: r.docketNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  allocatedColumnFilterValues.ewayBill = allocatedEwayGroups
    .map(r => ({ value: r.ewayBillNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Warehouse Module</h1>
          <p className="text-muted-foreground mt-2">
            Allocate laptops from inventory to pending orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WarehouseExportButton />
          {canManage && (
            <Link
              href="/dashboard/warehouse/add"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-press"
            >
              <Plus className="size-4" />
              Add Order
            </Link>
          )}
        </div>
      </div>

      <WarehouseTabs qcCount={qcPendingCount} />

      {activeTab === "qc" ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ClipboardCheck className="size-5 text-amber-500" />
            QC Assignments
          </h2>

          <QcPendingTable
            items={serializedQc}
            canManage={canManage}
            totalCount={qcTotalCount}
            columnFilterValues={qcColumnFilterValues}
          />
          {qcTotalCount > 0 && (
            <PaginationBar basePath="/dashboard/warehouse" currentPage={safeQcPage} totalPages={qcTotalPages} totalCount={qcTotalCount} limit={limit} />
          )}
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100">
                <ClipboardCheck className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">QC Pending</p>
                <p className="text-2xl font-bold text-primary mt-1">{qcPendingCount}</p>
              </div>
            </div>
            <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-100">
                <Clock className="size-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Pending Allocation</p>
                <p className="text-2xl font-bold text-primary mt-1">{pendingOrders.length}</p>
              </div>
            </div>
            <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <Package className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Available Stock</p>
                <p className="text-2xl font-bold text-primary mt-1">{availableInventory.length}</p>
              </div>
            </div>
            <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Allocated Assets</p>
                <p className="text-2xl font-bold text-primary mt-1">{totalAllocated}</p>
              </div>
            </div>
          </div>

          {/* Pending Orders — Allocation required */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="size-5 text-yellow-500" />
              Pending Allocation
            </h2>

            <PendingAllocationsTable
              orders={pendingOrders}
              availableItems={availableInventory}
              canManage={canManage}
            />
          </div>

          {/* Allocated Assets */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="size-5 text-green-500" />
              Allocated Assets
            </h2>

            <AllocatedAssetsTable
              orders={allocatedOrders}
              canManage={canManage}
              totalCount={totalAllocated}
              currentPage={page}
              pageSize={limit}
              columnFilterValues={allocatedColumnFilterValues}
            />
          </div>
        </>
      )}
    </div>
  );
}
