import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CheckCircle, Clock, Wrench, User, Upload } from "lucide-react";
import Link from "next/link";
import { ProvisioningTable } from "@/components/provisioning/provisioning-table";
import { ProvisioningPagination } from "@/components/provisioning/provisioning-pagination";
import { ProvisioningExportButton } from "@/components/provisioning/provisioning-export-button";
import { QcWorkTable } from "@/components/provisioning/qc-work-table";
import { ProvisioningTabs } from "@/components/provisioning/provisioning-tabs";
import type { QcItem } from "@/components/qc/qc-panel";
import { parseColumnFilters, blankTokenConditions, collectBlankTokenConditions, andFilterConditions, computeDistinctValues } from "@/lib/column-filters";
import { ORDER_PIPELINE_STATUSES, ACTIVE_PROVISIONING_STATUSES, HANDED_OVER_STATUSES } from "@/lib/order-status";
import type { Prisma } from "@prisma/client";

const PROVISIONING_FILTER_KEYS = ["serialNumber", "model", "imageType", "stickerColour", "clientName", "engineerName", "warehouseLocation", "provisioningLocation", "assetStatus"];
const QC_FILTER_KEYS = ["serialNumber", "model", "employeeName", "invoicingWarehouse", "qcCleanResult", "qcPurgeResult"];

function safeISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  const t = date.getTime();
  return isNaN(t) ? null : date.toISOString();
}

export default async function ProvisioningPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "25", 10) || 25));
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
  const selectedEngineer = typeof searchParams.engineer === "string" ? searchParams.engineer : "";
  const activeTab = typeof searchParams.tab === "string" && searchParams.tab === "qc" ? "qc" : "provisioning";
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "PROVISIONING"));

  if (selectedId) {
    const selOrder = await prisma.order.findUnique({
      where: { id: selectedId },
      select: { updatedAt: true, status: true },
    });
    if (selOrder && !ORDER_PIPELINE_STATUSES.includes(selOrder.status)) {
      const pos = await prisma.order.count({
        where: { status: { in: ORDER_PIPELINE_STATUSES }, updatedAt: { gt: selOrder.updatedAt } },
      });
      const correctPage = Math.floor(pos / limit) + 1;
      if (correctPage !== page) {
        redirect(`/dashboard/provisioning?page=${correctPage}&limit=${limit}&selected=${selectedId}`);
      }
    }
  }

  const baseWhere: Prisma.OrderWhereInput = { status: { in: ORDER_PIPELINE_STATUSES } };
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

  const columnFilters = parseColumnFilters(searchParams, PROVISIONING_FILTER_KEYS);
  const assetFilters: Prisma.AssetWhereInput[] = [];
  if (columnFilters.serialNumber) assetFilters.push({ inventoryItem: { serialNumber: { in: columnFilters.serialNumber } } });
  if (columnFilters.model) assetFilters.push({ inventoryItem: { model: { in: columnFilters.model } } });
  const nestedBlank = (field: string, selected: string[]) => ({
    OR: blankTokenConditions(field, selected).map(condition => ({ inventoryItem: condition })),
  });
  if (columnFilters.imageType) assetFilters.push(nestedBlank("imageType", columnFilters.imageType));
  if (columnFilters.stickerColour) assetFilters.push(nestedBlank("stickerColour", columnFilters.stickerColour));
  if (columnFilters.assetStatus) assetFilters.push({ status: { in: columnFilters.assetStatus } });
  if (assetFilters.length) where.assets = { some: { AND: assetFilters } };
  if (columnFilters.clientName) where.clientName = { in: columnFilters.clientName };
  andFilterConditions(where, collectBlankTokenConditions(columnFilters, {
    engineerName: "engineerName",
    warehouseLocation: "warehouseLocation",
    provisioningLocation: "provisioningLocation",
  }));

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

  const [serialNumberGroups, modelGroups, imageTypeGroups, stickerColourGroups, assetStatusGroups, clientNameGroups, engineerNameGroups, warehouseLocationGroups, provisioningLocationGroups] = await Promise.all([
    prisma.inventoryItem.groupBy({
      by: ["serialNumber"],
      where: { assets: { some: { order: where } } },
      _count: { _all: true },
    }),
    prisma.inventoryItem.groupBy({
      by: ["model"],
      where: { assets: { some: { order: where } } },
      _count: { _all: true },
    }),
    prisma.inventoryItem.groupBy({
      by: ["imageType"],
      where: { assets: { some: { order: where } } },
      _count: { _all: true },
    }),
    prisma.inventoryItem.groupBy({
      by: ["stickerColour"],
      where: { assets: { some: { order: where } } },
      _count: { _all: true },
    }),
    prisma.asset.groupBy({
      by: ["status"],
      where: { order: where },
      _count: { _all: true },
    }),
    prisma.order.groupBy({ by: ["clientName"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["engineerName"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["warehouseLocation"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["provisioningLocation"], where, _count: { _all: true } }),
  ]);

  const columnFilterValues: Record<string, { value: string; count: number }[]> = {};
  columnFilterValues.serialNumber = serialNumberGroups
    .map(r => ({ value: r.serialNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.model = modelGroups
    .map(r => ({ value: r.model ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.imageType = imageTypeGroups
    .map(r => ({ value: r.imageType ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.stickerColour = stickerColourGroups
    .map(r => ({ value: r.stickerColour ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.assetStatus = assetStatusGroups
    .map(r => ({ value: r.status ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.clientName = clientNameGroups
    .map(r => ({ value: r.clientName ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.engineerName = engineerNameGroups
    .map(r => ({ value: r.engineerName ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.warehouseLocation = warehouseLocationGroups
    .map(r => ({ value: r.warehouseLocation ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.provisioningLocation = provisioningLocationGroups
    .map(r => ({ value: r.provisioningLocation ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const engineers = [...new Set(orders.map(o => o.engineerName).filter(Boolean))] as string[];
  const inProvisioningCount = orders.filter(o => ACTIVE_PROVISIONING_STATUSES.includes(o.status)).length;
  const handedOverCount = orders.filter(o => !ACTIVE_PROVISIONING_STATUSES.includes(o.status)).length;
  const totalAssets = orders.reduce((sum, o) => sum + o.assets.length, 0);

  const qcFilters = parseColumnFilters(searchParams, QC_FILTER_KEYS);
  const qcWhere: Prisma.InventoryItemWhereInput = {
    AND: {
      OR: [{ status: "QC_PENDING" }, { qcCompletedAt: { not: null } }],
      ...(qcFilters.serialNumber ? { serialNumber: { in: qcFilters.serialNumber } } : {}),
      ...(qcFilters.model ? { model: { in: qcFilters.model } } : {}),
      ...(qcFilters.employeeName ? { employeeName: { in: qcFilters.employeeName } } : {}),
      ...(qcFilters.invoicingWarehouse ? { invoicingWarehouse: { in: qcFilters.invoicingWarehouse } } : {}),
      ...(qcFilters.qcCleanResult ? { qcCleanResult: { in: qcFilters.qcCleanResult } } : {}),
      ...(qcFilters.qcPurgeResult ? { qcPurgeResult: { in: qcFilters.qcPurgeResult } } : {}),
    },
  };

  const qcPendingItems = await prisma.inventoryItem.findMany({
    where: qcWhere,
    orderBy: { qcRequestedAt: "desc" },
  });

  const serializedQc: QcItem[] = qcPendingItems.map(i => ({
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

  const myQcItems = user
    ? serializedQc.filter(i => i.qcEngineer === user.name)
    : [];

  const qcColumnFilterValues = computeDistinctValues(serializedQc, {
    serialNumber: r => r.serialNumber,
    model: r => r.model,
    employeeName: r => r.employeeName,
    invoicingWarehouse: r => r.invoicingWarehouse,
    qcCleanResult: r => r.qcCleanResult,
    qcPurgeResult: r => r.qcPurgeResult,
  });

  // Split orders into: active (needs provisioning work), handed over to logistics,
  // and later stages (packing, dispatch, delivery, RTO, etc). All stay visible.
  const activeOrders = orders.filter(o => ACTIVE_PROVISIONING_STATUSES.includes(o.status));
  const handedOverOrders = orders.filter(o => HANDED_OVER_STATUSES.includes(o.status));
  const laterOrders = orders.filter(o =>
    !ACTIVE_PROVISIONING_STATUSES.includes(o.status) && !HANDED_OVER_STATUSES.includes(o.status)
  );

  // Group data by engineer for sections
  const sections: { label: string; orders: typeof orders }[] = [];

  const unassignedOrders = activeOrders.filter(o => !o.engineerName);
  if (unassignedOrders.length > 0) {
    sections.push({ label: "Unassigned", orders: unassignedOrders });
  }

  for (const eng of engineers) {
    const engOrders = activeOrders.filter(o => o.engineerName === eng);
    if (engOrders.length > 0) {
      sections.push({ label: eng, orders: engOrders });
    }
  }

  const visibleSections = selectedEngineer
    ? sections.filter(s => s.label === selectedEngineer)
    : sections;

  const handedOverVisible = selectedEngineer
    ? handedOverOrders.filter(o => o.engineerName === selectedEngineer)
    : handedOverOrders;

  const laterVisible = selectedEngineer
    ? laterOrders.filter(o => o.engineerName === selectedEngineer)
    : laterOrders;

  function engineerUrl(engineer: string) {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (selectedId) p.set("selected", selectedId);
    if (page > 1) p.set("page", String(page));
    if (limit !== 25) p.set("limit", String(limit));
    if (engineer) p.set("engineer", engineer);
    const qs = p.toString();
    return `/dashboard/provisioning${qs ? `?${qs}` : ""}`;
  }

  const btnBase = "px-4 py-2 rounded-lg text-sm font-semibold transition-all border";
  const btnActive = "bg-primary text-primary-foreground border-primary shadow-sm";
  const btnInactive = "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground";

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Provisioning Module</h1>
          <p className="text-muted-foreground mt-2">
            Track OS installation and hardware quality checks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/provisioning/import"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-accent active:translate-y-press"
          >
            <Upload className="size-4" />
            Import
          </Link>
          <ProvisioningExportButton />
        </div>
      </div>

      <ProvisioningTabs qcCount={myQcItems.filter(i => !i.qcCompletedAt).length} />

      {activeTab === "qc" ? (
        <QcWorkTable items={myQcItems} columnFilterValues={qcColumnFilterValues} />
      ) : (
        <>
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

          {sections.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={engineerUrl("")}
                className={`${btnBase} ${!selectedEngineer ? btnActive : btnInactive}`}
              >
                All ({sections.length})
              </Link>
              {sections.map(s => (
                <Link
                  key={s.label}
                  href={engineerUrl(s.label)}
                  className={`${btnBase} ${selectedEngineer === s.label ? btnActive : btnInactive}`}
                >
                  <User className="inline size-3.5 mr-1" />
                  {s.label}
                  <span className="ml-1.5 text-xs opacity-70">({s.orders.reduce((sum, o) => sum + o.assets.length, 0)})</span>
                </Link>
              ))}
            </div>
          )}

          {visibleSections.length === 0 && handedOverVisible.length === 0 && laterVisible.length === 0 ? (
            <div className="p-8 rounded-xl glass text-center text-muted-foreground">
              {selectedEngineer
                ? `No orders found for "${selectedEngineer}".`
                : "No orders ready for provisioning. Allocate inventory in the Warehouse module first."}
            </div>
          ) : (
            visibleSections.map((section) => (
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
                  columnFilterValues={columnFilterValues}
                />
              </section>
            ))
          )}

          {handedOverVisible.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <CheckCircle className="size-5 text-green-600" />
                Handed Over to Logistics
                <span className="text-sm font-normal text-muted-foreground">
                  — {handedOverVisible.length} order(s), {handedOverVisible.reduce((s, o) => s + o.assets.length, 0)} asset(s)
                </span>
              </h2>
              <ProvisioningTable
                orders={handedOverVisible}
                canManage={canManage}
                engineers={engineers}
                selectedId={selectedId}
                columnFilterValues={columnFilterValues}
              />
            </section>
          )}

          {laterVisible.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Wrench className="size-5 text-purple-600" />
                Further Stages
                <span className="text-sm font-normal text-muted-foreground">
                  — {laterVisible.length} order(s), {laterVisible.reduce((s, o) => s + o.assets.length, 0)} asset(s)
                </span>
              </h2>
              <ProvisioningTable
                orders={laterVisible}
                canManage={canManage}
                engineers={engineers}
                selectedId={selectedId}
                columnFilterValues={columnFilterValues}
              />
            </section>
          )}

          <ProvisioningPagination totalCount={totalCount} currentPage={page} pageSize={limit} />
        </>
      )}
    </div>
  );
}
