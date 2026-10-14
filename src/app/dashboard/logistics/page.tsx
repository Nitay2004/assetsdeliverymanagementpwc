import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, Truck, ClipboardList, FileText, Hash } from "lucide-react";
import { LogisticsTable } from "@/components/logistics/logistics-table";
import { ReversePickupDocketSection } from "@/components/logistics/reverse-pickup-docket-section";
import { ReversePickupPartnerAlignSection } from "@/components/logistics/reverse-pickup-partner-align-section";
import { LogisticsExportButton } from "@/components/logistics/logistics-export-button";
import { PodExportButton } from "@/components/logistics/pod-export-button";
import { getWarehouses } from "@/app/actions/dc";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { ForwardReverseTabs } from "@/components/shared/forward-reverse-tabs";
import { getCorrectOrderPage } from "@/lib/order-page";
import { parseColumnFilters, blankTokenConditions, collectBlankTokenConditions, andFilterConditions } from "@/lib/column-filters";
import { ORDER_PIPELINE_STATUSES } from "@/lib/order-status";
import type { Prisma, OrderStatus, ReversePickupStatus } from "@prisma/client";

const STATUS_FILTER = ORDER_PIPELINE_STATUSES;
const LOGISTICS_FILTER_KEYS = ["clientName", "dcNumber", "deliveryLocation", "totalQuantity", "serialNumber", "dockets", "ewayBill", "status"];
// Each reverse queue owns its filter params so a filter set on one queue never
// follows the user into the other.
const ALIGN_FILTER_KEYS = ["aserial", "amodel", "aemployee", "acity"];
const DOCKET_FILTER_KEYS = ["dserial", "dmodel", "demployee", "dcity", "dstatus"];

export default async function LogisticsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "10", 10) || 10));
  // The reverse queues share this route with the forward table, so they page on
  // their own params: moving one table never moves the other.
  const rpage = Math.max(1, parseInt(typeof searchParams.rpage === "string" ? searchParams.rpage : "1", 10) || 1);
  const rlimit = Math.min(100, Math.max(1, parseInt(typeof searchParams.rlimit === "string" ? searchParams.rlimit : "10", 10) || 10));
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

  const activeTab = searchParams.tab === "reverse" ? "reverse" : "forward";
  // Reverse work is two queues: align a pickup partner first, then assign the
  // docket. `rtab` tracks which queue the reverse tab is showing.
  const reverseSubTab = searchParams.rtab === "docket" ? "docket" : "align";
  const isDocketQueue = reverseSubTab === "docket";

  // Queue membership is the request status. Each queue is counted and paged on
  // its own so the badges reflect the whole queue, not just the visible page.
  const rpAlignBaseWhere: Prisma.ReversePickupRequestWhereInput = {
    status: {
      in: [
        "REQUESTED",
        "PENDING",
        "PWC_CONFIRMATION_AWAITED",
        "GATEPASS_PENDING",
        "ALIGN_FOR_PICKUP",
        "ON_HOLD",
      ],
    },
  };
  const rpDocketBaseWhere: Prisma.ReversePickupRequestWhereInput = {
    // Stays in the list once the docket is assigned so the row does not vanish
    // right after logistics hits save.
    status: { in: ["DOCKET_REQUESTED", "DOCKET_ASSIGNED"] },
  };

  // Badges count the whole queue; filters only narrow what is listed.
  const [alignCount, docketQueueCount, docketPending] = await Promise.all([
    prisma.reversePickupRequest.count({ where: rpAlignBaseWhere }),
    prisma.reversePickupRequest.count({ where: rpDocketBaseWhere }),
    prisma.reversePickupRequest.count({ where: { status: "DOCKET_REQUESTED" } }),
  ]);

  const alignColumnFilters = parseColumnFilters(searchParams, ALIGN_FILTER_KEYS);
  const docketColumnFilters = parseColumnFilters(searchParams, DOCKET_FILTER_KEYS);
  const alignSearch = typeof searchParams.asearch === "string" ? searchParams.asearch.trim() : "";
  const docketSearch = typeof searchParams.dsearch === "string" ? searchParams.dsearch.trim() : "";

  const rpAlignWhere: Prisma.ReversePickupRequestWhereInput = { ...rpAlignBaseWhere };
  if (alignSearch) {
    rpAlignWhere.OR = [
      { requestNumber: { contains: alignSearch, mode: "insensitive" } },
      { serialNumber: { contains: alignSearch, mode: "insensitive" } },
      { model: { contains: alignSearch, mode: "insensitive" } },
      { employeeName: { contains: alignSearch, mode: "insensitive" } },
      { city: { contains: alignSearch, mode: "insensitive" } },
    ];
  }
  if (alignColumnFilters.aserial) rpAlignWhere.serialNumber = { in: alignColumnFilters.aserial };
  if (alignColumnFilters.amodel) rpAlignWhere.model = { in: alignColumnFilters.amodel };
  if (alignColumnFilters.aemployee) rpAlignWhere.employeeName = { in: alignColumnFilters.aemployee };
  if (alignColumnFilters.acity) rpAlignWhere.city = { in: alignColumnFilters.acity };

  const rpDocketWhere: Prisma.ReversePickupRequestWhereInput = { ...rpDocketBaseWhere };
  if (docketSearch) {
    rpDocketWhere.OR = [
      { requestNumber: { contains: docketSearch, mode: "insensitive" } },
      { serialNumber: { contains: docketSearch, mode: "insensitive" } },
      { model: { contains: docketSearch, mode: "insensitive" } },
      { employeeName: { contains: docketSearch, mode: "insensitive" } },
      { city: { contains: docketSearch, mode: "insensitive" } },
      { docketNumber: { contains: docketSearch, mode: "insensitive" } },
    ];
  }
  if (docketColumnFilters.dserial) rpDocketWhere.serialNumber = { in: docketColumnFilters.dserial };
  if (docketColumnFilters.dmodel) rpDocketWhere.model = { in: docketColumnFilters.dmodel };
  if (docketColumnFilters.demployee) rpDocketWhere.employeeName = { in: docketColumnFilters.demployee };
  if (docketColumnFilters.dcity) rpDocketWhere.city = { in: docketColumnFilters.dcity };
  if (docketColumnFilters.dstatus) rpDocketWhere.status = { in: docketColumnFilters.dstatus as ReversePickupStatus[] };

  const reverseWhere = isDocketQueue ? rpDocketWhere : rpAlignWhere;
  const reverseTotalCount = await prisma.reversePickupRequest.count({ where: reverseWhere });
  const reverseTotalPages = Math.max(1, Math.ceil(reverseTotalCount / rlimit));
  const safeRPage = Math.min(rpage, reverseTotalPages);

  const rpRequests = await prisma.reversePickupRequest.findMany({
    where: reverseWhere,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (safeRPage - 1) * rlimit,
    take: rlimit,
  });

  // Filter dropdown values for the active queue only.
  const reverseColumnFilterValues: Record<string, { value: string; count: number }[]> = {};
  if (isDocketQueue) {
    const [dSerial, dModel, dEmployee, dCity, dStatus] = await Promise.all([
      prisma.reversePickupRequest.groupBy({ by: ["serialNumber"], where: rpDocketWhere, _count: { _all: true } }),
      prisma.reversePickupRequest.groupBy({ by: ["model"], where: rpDocketWhere, _count: { _all: true } }),
      prisma.reversePickupRequest.groupBy({ by: ["employeeName"], where: rpDocketWhere, _count: { _all: true } }),
      prisma.reversePickupRequest.groupBy({ by: ["city"], where: rpDocketWhere, _count: { _all: true } }),
      prisma.reversePickupRequest.groupBy({ by: ["status"], where: rpDocketWhere, _count: { _all: true } }),
    ]);
    reverseColumnFilterValues.dserial = dSerial.map(r => ({ value: r.serialNumber ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value));
    reverseColumnFilterValues.dmodel = dModel.map(r => ({ value: r.model ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value));
    reverseColumnFilterValues.demployee = dEmployee.map(r => ({ value: r.employeeName ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value));
    reverseColumnFilterValues.dcity = dCity.map(r => ({ value: r.city ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value));
    reverseColumnFilterValues.dstatus = dStatus.map(r => ({ value: r.status ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value));
  } else {
    const [aSerial, aModel, aEmployee, aCity] = await Promise.all([
      prisma.reversePickupRequest.groupBy({ by: ["serialNumber"], where: rpAlignWhere, _count: { _all: true } }),
      prisma.reversePickupRequest.groupBy({ by: ["model"], where: rpAlignWhere, _count: { _all: true } }),
      prisma.reversePickupRequest.groupBy({ by: ["employeeName"], where: rpAlignWhere, _count: { _all: true } }),
      prisma.reversePickupRequest.groupBy({ by: ["city"], where: rpAlignWhere, _count: { _all: true } }),
    ]);
    reverseColumnFilterValues.aserial = aSerial.map(r => ({ value: r.serialNumber ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value));
    reverseColumnFilterValues.amodel = aModel.map(r => ({ value: r.model ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value));
    reverseColumnFilterValues.aemployee = aEmployee.map(r => ({ value: r.employeeName ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value));
    reverseColumnFilterValues.acity = aCity.map(r => ({ value: r.city ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value));
  }

  // Both queues expose the same row shape, so the date serialization lives in
  // one place instead of drifting between two near-identical maps.
  const serializedRp = rpRequests.map((r) => ({
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
    expectedPickupDate: r.expectedPickupDate ? r.expectedPickupDate.toISOString() : null,
    actualDeliveryPodDate: r.actualDeliveryPodDate ? r.actualDeliveryPodDate.toISOString() : null,
    laptopAcceptanceDate: r.laptopAcceptanceDate ? r.laptopAcceptanceDate.toISOString() : null,
    etaForUnitReceived: r.etaForUnitReceived ? r.etaForUnitReceived.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);
  // The top-level Reverse badge covers both queues, matching what the tab holds.
  const reversePending = alignCount + docketPending;

  // Sub-tab links keep search / filters / reverse state and only reset the page,
  // so switching queues never silently drops the active view.
  const subTabHref = (rtab: "align" | "docket") => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") params.set(key, value);
    }
    params.set("tab", "reverse");
    params.set("rtab", rtab);
    params.delete("page");
    params.delete("selected");
    // Each queue keeps its own page, so switching queens starts the new one at 1.
    params.delete("rpage");
    return `/dashboard/logistics?${params.toString()}`;
  };

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
      ) : (
        <div className="space-y-4">
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            <Link
              href={subTabHref("align")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${reverseSubTab === "align" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pickup Alignment
              {alignCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                  {alignCount}
                </span>
              )}
            </Link>
            <Link
              href={subTabHref("docket")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${reverseSubTab === "docket" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Dockets
              {docketPending > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                  {docketPending}
                </span>
              )}
            </Link>
          </div>

          {reverseSubTab === "align" ? (
            alignCount > 0 ? (
              <>
                <ReversePickupPartnerAlignSection requests={serializedRp} canManage={canManage} totalPending={alignCount} columnFilterValues={reverseColumnFilterValues} />
                <PaginationBar basePath="/dashboard/logistics" currentPage={safeRPage} totalPages={reverseTotalPages} totalCount={reverseTotalCount} limit={rlimit} pageParam="rpage" limitParam="rlimit" />
              </>
            ) : (
              <div className="p-8 rounded-xl glass text-center text-muted-foreground">
                No requests pending for partner alignment.
              </div>
            )
          ) : docketQueueCount > 0 ? (
            <>
              <ReversePickupDocketSection requests={serializedRp} canManage={canManage} totalPending={docketPending} columnFilterValues={reverseColumnFilterValues} />
              <PaginationBar basePath="/dashboard/logistics" currentPage={safeRPage} totalPages={reverseTotalPages} totalCount={reverseTotalCount} limit={rlimit} pageParam="rpage" limitParam="rlimit" />
            </>
          ) : (
            <div className="p-8 rounded-xl glass text-center text-muted-foreground">
              No reverse pickup docket requests pending.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
