import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Package, Truck, ClipboardList, FileText, Hash } from "lucide-react";
import { LogisticsTable } from "@/components/logistics/logistics-table";
import { ReversePickupDocketSection } from "@/components/logistics/reverse-pickup-docket-section";
import { LogisticsExportButton } from "@/components/logistics/logistics-export-button";
import { PodExportButton } from "@/components/logistics/pod-export-button";
import { getWarehouses } from "@/app/actions/dc";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { ForwardReverseTabs } from "@/components/shared/forward-reverse-tabs";
import { getCorrectOrderPage } from "@/lib/order-page";
import { parseColumnFilters, blankTokenConditions, collectBlankTokenConditions, andFilterConditions } from "@/lib/column-filters";
import { ORDER_PIPELINE_STATUSES } from "@/lib/order-status";
import type { Prisma, OrderStatus } from "@prisma/client";

const STATUS_FILTER = ORDER_PIPELINE_STATUSES;
const LOGISTICS_FILTER_KEYS = ["clientName", "dcNumber", "deliveryLocation", "totalQuantity", "serialNumber", "dockets", "ewayBill", "status"];

export default async function LogisticsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "10", 10) || 10));
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "LOGISTICS"));

  if (selectedId) {
    const correctPage = await getCorrectOrderPage(selectedId, STATUS_FILTER, limit);
    if (correctPage && correctPage !== page) {
      redirect(`/dashboard/logistics?page=${correctPage}&limit=${limit}&selected=${selectedId}`);
    }
  }

  const baseWhere: Prisma.OrderWhereInput = { status: { in: STATUS_FILTER } };
  const where: Prisma.OrderWhereInput = search ? {
    ...baseWhere,
    OR: [
      { clientName: { contains: search, mode: "insensitive" as const } },
      { deliveryLocation: { contains: search, mode: "insensitive" as const } },
      { dcNumber: { contains: search, mode: "insensitive" as const } },
      { assets: { some: { inventoryItem: { serialNumber: { contains: search, mode: "insensitive" as const } } } } },
      { dockets: { some: { docketNumber: { contains: search, mode: "insensitive" as const } } } },
      { dockets: { some: { ewayBillNumber: { contains: search, mode: "insensitive" as const } } } },
    ],
  } : baseWhere;

  const columnFilters = parseColumnFilters(searchParams, LOGISTICS_FILTER_KEYS);
  const assetFilters: Prisma.AssetWhereInput[] = [];
  if (columnFilters.serialNumber) assetFilters.push({ inventoryItem: { serialNumber: { in: columnFilters.serialNumber } } });
  const docketFilters: Prisma.DocketWhereInput[] = [];
  if (columnFilters.dockets) docketFilters.push({ OR: blankTokenConditions("docketNumber", columnFilters.dockets) });
  if (columnFilters.ewayBill) docketFilters.push({ OR: blankTokenConditions("ewayBillNumber", columnFilters.ewayBill) });
  if (assetFilters.length) where.assets = { some: { AND: assetFilters } };
  if (docketFilters.length) where.dockets = { some: { AND: docketFilters } };
  if (columnFilters.clientName) where.clientName = { in: columnFilters.clientName };
  if (columnFilters.deliveryLocation) where.deliveryLocation = { in: columnFilters.deliveryLocation };
  if (columnFilters.status) where.status = { in: columnFilters.status as OrderStatus[] };
  if (columnFilters.totalQuantity) where.totalQuantity = { in: columnFilters.totalQuantity.map(Number) };
  andFilterConditions(where, collectBlankTokenConditions(columnFilters, { dcNumber: "dcNumber" }));

  const totalCount = await prisma.order.count({ where });
  const rawOrders = await prisma.order.findMany({
    where,
    include: {
      dockets: { orderBy: [{ createdAt: "desc" }, { id: "asc" }] },
      assets: { include: { inventoryItem: true } },
      deliveryChallans: {
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 1,
      },
      rtoRecords: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * limit,
    take: limit,
  });

  const serialized = rawOrders.map(o => ({
    ...o,
    deliveryChallans: o.deliveryChallans.map(dc => ({
      ...dc,
      taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
      igst: dc.igst ? Number(dc.igst) : null,
      totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    })),
  }));

  const [clientNameGroups, dcNumberGroups, deliveryLocationGroups, totalQuantityGroups, statusGroups, serialNumberGroups, docketGroups, ewayBillGroups] = await Promise.all([
    prisma.order.groupBy({ by: ["clientName"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["dcNumber"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["deliveryLocation"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["totalQuantity"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({
      by: ["serialNumber"],
      where: { assets: { some: { order: where } } },
      _count: { _all: true },
    }),
    prisma.docket.groupBy({
      by: ["docketNumber", "courierName"],
      where: { order: where },
      _count: { _all: true },
    }),
    prisma.docket.groupBy({
      by: ["ewayBillNumber"],
      where: { order: where },
      _count: { _all: true },
    }),
  ]);

  const columnFilterValues: Record<string, { value: string; count: number }[]> = {};
  columnFilterValues.clientName = clientNameGroups
    .map(r => ({ value: r.clientName ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.dcNumber = dcNumberGroups
    .map(r => ({ value: r.dcNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.deliveryLocation = deliveryLocationGroups
    .map(r => ({ value: r.deliveryLocation ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.totalQuantity = totalQuantityGroups
    .map(r => ({ value: r.totalQuantity == null || String(r.totalQuantity).trim() === "" ? "(Blank)" : String(r.totalQuantity), count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.status = statusGroups
    .map(r => ({ value: r.status ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.serialNumber = serialNumberGroups
    .map(r => ({ value: r.serialNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const docketMap = new Map<string, number>();
  for (const r of docketGroups) {
    const token = r.docketNumber
      ? `${r.docketNumber}${r.courierName ? ` · ${r.courierName}` : ""}`
      : "(Blank)";
    docketMap.set(token, (docketMap.get(token) ?? 0) + r._count._all);
  }
  columnFilterValues.dockets = [...docketMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));

  columnFilterValues.ewayBill = ewayBillGroups
    .map(r => ({ value: r.ewayBillNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));

  // Stat cards must cover the whole filtered result set — computing them from
  // `rawOrders` (one page) made the numbers depend on which page you were on.
  const [needsDocket, awaitingFinance, readyToPack, inTransit] = await Promise.all([
    prisma.order.count({ where: { AND: [where, { status: "DOCKET_REQUESTED" }] } }),
    prisma.order.count({ where: { AND: [where, { status: { in: ["DOCKET_ASSIGNED", "DC_REQUESTED", "EWAY_BILL_REQUESTED", "RTO_DC_REQUESTED", "RTO_EWAY_BILL_REQUESTED"] } }] } }),
    prisma.order.count({ where: { AND: [where, { status: { in: ["DC_GENERATED", "EWAY_BILL_GENERATED", "RTO_DC_GENERATED", "RTO_EWAY_BILL_GENERATED"] } }] } }),
    prisma.order.count({ where: { AND: [where, { status: { in: ["DISPATCHED", "DELIVERED", "RTO_IN_TRANSIT", "RTO_DELIVERED_TO_WAREHOUSE"] } }] } }),
  ]);

  const warehouses = await getWarehouses();

  const rpDocketRequests = await prisma.reversePickupRequest.findMany({
    // Stays in the list once the docket is assigned so the row does not vanish
    // right after logistics hits save.
    where: { status: { in: ["DOCKET_REQUESTED", "DOCKET_ASSIGNED"] } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  const serializedRp = rpDocketRequests.map(r => ({
    ...r,
    requestDateHp: r.requestDateHp ? r.requestDateHp.toISOString() : null,
    lastWorkingDay: r.lastWorkingDay ? r.lastWorkingDay.toISOString() : null,
    inspectionDate: r.inspectionDate ? r.inspectionDate.toISOString() : null,
    pickupDate: r.pickupDate ? r.pickupDate.toISOString() : null,
    receivedDate: r.receivedDate ? r.receivedDate.toISOString() : null,
    qcDate: r.qcDate ? r.qcDate.toISOString() : null,
    blanccoDate: r.blanccoDate ? r.blanccoDate.toISOString() : null,
    blancoCertificateDate: r.blancoCertificateDate ? r.blancoCertificateDate.toISOString() : null,
    eta: r.eta ? r.eta.toISOString() : null,
    futureDatePickup: r.futureDatePickup ? r.futureDatePickup.toISOString() : null,
    slaStartDate: r.slaStartDate ? r.slaStartDate.toISOString() : null,
    actualDeliveryPodDate: r.actualDeliveryPodDate ? r.actualDeliveryPodDate.toISOString() : null,
    laptopAcceptanceDate: r.laptopAcceptanceDate ? r.laptopAcceptanceDate.toISOString() : null,
    etaForUnitReceived: r.etaForUnitReceived ? r.etaForUnitReceived.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);
  const activeTab = searchParams.tab === "reverse" ? "reverse" : "forward";
  // Badge = docket still to assign, not the ones already assigned.
  const reversePending = serializedRp.filter(r => r.status === "DOCKET_REQUESTED").length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Logistics Module</h1>
          <p className="text-muted-foreground mt-2">
            Request DC, assign dockets, pack, label, and manage E-Way bills.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PodExportButton />
          <LogisticsExportButton />
        </div>
      </div>

      <ForwardReverseTabs reverseCount={reversePending} />

      <div className="grid gap-4 sm:grid-cols-5">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100">
            <Hash className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Needs Docket</p>
            <p className="text-2xl font-bold text-primary mt-1">{needsDocket}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-100">
            <FileText className="size-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Awaiting Finance</p>
            <p className="text-2xl font-bold text-primary mt-1">{awaitingFinance}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-100">
            <Package className="size-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Ready to Pack</p>
            <p className="text-2xl font-bold text-primary mt-1">{readyToPack}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-orange-100">
            <Truck className="size-5 text-orange-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">In Transit</p>
            <p className="text-2xl font-bold text-primary mt-1">{inTransit}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100">
            <ClipboardList className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Orders</p>
            <p className="text-2xl font-bold text-primary mt-1">{totalCount}</p>
          </div>
        </div>
      </div>

      {activeTab === "forward" ? (
        <>
          <LogisticsTable orders={serialized} canManage={canManage} warehouses={warehouses} selectedId={selectedId} columnFilterValues={columnFilterValues} />

          <PaginationBar basePath="/dashboard/logistics" currentPage={safePage} totalPages={totalPages} totalCount={totalCount} limit={limit} />
        </>
      ) : serializedRp.length > 0 ? (
        <ReversePickupDocketSection requests={serializedRp} canManage={canManage} />
      ) : (
        <div className="p-8 rounded-xl glass text-center text-muted-foreground">
          No reverse pickup cases waiting for a docket.
        </div>
      )}
    </div>
  );
}
