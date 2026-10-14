import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { FinanceOrderTable } from "@/components/finance/finance-order-table";
import { ReversePickupFinanceSection } from "@/components/finance/reverse-pickup-finance-section";
import { FinanceExportButton } from "@/components/finance/finance-export-button";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { ForwardReverseTabs } from "@/components/shared/forward-reverse-tabs";
import { getCorrectOrderPage } from "@/lib/order-page";
import { parseColumnFilters, blankTokenConditions, collectBlankTokenConditions, andFilterConditions } from "@/lib/column-filters";
import { ORDER_PIPELINE_STATUSES, FORWARD_DC_STATUSES, FORWARD_EWAY_STATUSES } from "@/lib/order-status";
import type { Prisma, OrderStatus, ReversePickupStatus } from "@prisma/client";

const STATUS_FILTER = ORDER_PIPELINE_STATUSES;
const FINANCE_FILTER_KEYS = ["clientName", "deliveryLocation", "totalQuantity", "serialNumber", "dcNumber", "ewayBill", "status"];
// Reverse finance filters are namespaced so they never collide with the
// forward table's params, which share this route.
const REVERSE_FINANCE_FILTER_KEYS = ["rmodel", "remployee", "rstatus", "rdc", "reway"];

export default async function FinancePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "10", 10) || 10));
  // Reverse queues page on their own params so they never move the forward table.
  const rpage = Math.max(1, parseInt(typeof searchParams.rpage === "string" ? searchParams.rpage : "1", 10) || 1);
  const rlimit = Math.min(100, Math.max(1, parseInt(typeof searchParams.rlimit === "string" ? searchParams.rlimit : "10", 10) || 10));
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
  const financeSubTab = typeof searchParams.ftab === "string" ? searchParams.ftab : (typeof searchParams.financeTab === "string" ? searchParams.financeTab : "dc");
  const subTab = (financeSubTab === "eway" || financeSubTab === "e-way" || financeSubTab === "eWay") ? "eway" : "dc";
  const forwardStatuses = subTab === "eway" ? FORWARD_EWAY_STATUSES : FORWARD_DC_STATUSES;
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "FINANCE"));

  if (selectedId) {
    const selectedOrder = await prisma.order.findUnique({ where: { id: selectedId }, select: { status: true } });
    if (selectedOrder) {
      const visibleHere = forwardStatuses.includes(selectedOrder.status);
      const targetTab = visibleHere ? subTab : (FORWARD_EWAY_STATUSES.includes(selectedOrder.status) ? "eway" : "dc");
      const targetStatuses = targetTab === "eway" ? FORWARD_EWAY_STATUSES : FORWARD_DC_STATUSES;
      const correctPage = await getCorrectOrderPage(selectedId, targetStatuses, limit);
      if (correctPage !== null && (correctPage !== page || targetTab !== subTab)) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(searchParams)) {
          if (typeof value === "string") params.set(key, value);
        }
        params.set("page", String(correctPage));
        params.set("limit", String(limit));
        params.set("selected", selectedId);
        params.set("ftab", targetTab);
        redirect(`/dashboard/finance?${params.toString()}`);
      }
    }
  }

  // Rows are scoped to the active sub-tab from the query itself so that a
  // generated DC / E-Way bill (which flips the status to *_GENERATED) never
  // falls out of the table after saving.
  const baseWhere: Prisma.OrderWhereInput = { status: { in: forwardStatuses } };
  const where: Prisma.OrderWhereInput = search ? {
    ...baseWhere,
    OR: [
      { clientName: { contains: search, mode: "insensitive" as const } },
      { deliveryLocation: { contains: search, mode: "insensitive" as const } },
      { invoiceNumber: { contains: search, mode: "insensitive" as const } },
      { dcNumber: { contains: search, mode: "insensitive" as const } },
      { assets: { some: { inventoryItem: { serialNumber: { contains: search, mode: "insensitive" as const } } } } },
      { dockets: { some: { docketNumber: { contains: search, mode: "insensitive" as const } } } },
      { dockets: { some: { ewayBillNumber: { contains: search, mode: "insensitive" as const } } } },
    ],
  } : baseWhere;

  const columnFilters = parseColumnFilters(searchParams, FINANCE_FILTER_KEYS);
  if (columnFilters.serialNumber) where.assets = { some: { inventoryItem: { serialNumber: { in: columnFilters.serialNumber } } } };
  const ewayFilters: Prisma.DocketWhereInput[] = [];
  if (columnFilters.ewayBill) ewayFilters.push({ OR: blankTokenConditions("ewayBillNumber", columnFilters.ewayBill) });
  if (ewayFilters.length && !where.dockets) where.dockets = { some: { AND: ewayFilters } };
  if (columnFilters.clientName) where.clientName = { in: columnFilters.clientName };
  if (columnFilters.deliveryLocation) where.deliveryLocation = { in: columnFilters.deliveryLocation };
  if (columnFilters.status) {
    // Keep the pick inside the active sub-tab so filtered rows cannot jump
    // into a table that does not render them.
    where.status = { in: (columnFilters.status as OrderStatus[]).filter(s => forwardStatuses.includes(s)) };
  }
  if (columnFilters.totalQuantity) where.totalQuantity = { in: columnFilters.totalQuantity.map(Number) };
  andFilterConditions(where, collectBlankTokenConditions(columnFilters, { dcNumber: "dcNumber" }));

  const pipelineStatuses = columnFilters.status
    ? (columnFilters.status as OrderStatus[]).filter(s => STATUS_FILTER.includes(s))
    : STATUS_FILTER;
  const dcPendingStatuses = (["IN_PROVISIONING", "DC_REQUESTED", "RTO_DC_REQUESTED"] as OrderStatus[])
    .filter(s => !columnFilters.status || (columnFilters.status as OrderStatus[]).includes(s));

  const [totalCount, pipelineTotalCount, pendingDC] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, status: { in: pipelineStatuses } } }),
    prisma.order.count({ where: { ...where, status: { in: dcPendingStatuses } } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);

  const rawOrders = await prisma.order.findMany({
    where,
    include: {
      deliveryChallans: {
        include: { items: true, warehouse: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      },
      dockets: { orderBy: [{ createdAt: "desc" }, { id: "asc" }] },
      assets: {
        include: { inventoryItem: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (safePage - 1) * limit,
    take: limit,
  });

  const orders = rawOrders.map(o => ({
    ...o,
    deliveryChallans: o.deliveryChallans.map(dc => ({
      ...dc,
      dcDate: dc.dcDate.toISOString(),
      taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
      igst: dc.igst ? Number(dc.igst) : null,
      totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
      items: dc.items.map(i => ({
        ...i,
        rate: Number(i.rate),
        amount: Number(i.amount),
        taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
        igstRate: i.igstRate ? Number(i.igstRate) : null,
        igstAmount: i.igstAmount ? Number(i.igstAmount) : null,
      })),
    })),
  }));

  const [clientNameGroups, deliveryLocationGroups, totalQuantityGroups, dcNumberGroups, statusGroups, serialNumberGroups, ewayBillGroups] = await Promise.all([
    prisma.order.groupBy({ by: ["clientName"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["deliveryLocation"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["totalQuantity"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["dcNumber"], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({
      by: ["serialNumber"],
      where: { assets: { some: { order: where } } },
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
  columnFilterValues.deliveryLocation = deliveryLocationGroups
    .map(r => ({ value: r.deliveryLocation ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.totalQuantity = totalQuantityGroups
    .map(r => ({ value: r.totalQuantity == null || String(r.totalQuantity).trim() === "" ? "(Blank)" : String(r.totalQuantity), count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.dcNumber = dcNumberGroups
    .map(r => ({ value: r.dcNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.status = statusGroups
    .map(r => ({ value: r.status ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.serialNumber = serialNumberGroups
    .map(r => ({ value: r.serialNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
  columnFilterValues.ewayBill = ewayBillGroups
    .map(r => ({ value: r.ewayBillNumber ?? "(Blank)", count: r._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const activeTab = searchParams.tab === "reverse" ? "reverse" : "forward";
  // Sticky reverse DC sub-tab: the case stays in the DC table through the
  // e-way stages too, so finance never loses the row after requesting or
  // generating the e-way bill.
  const reverseSubTab = ((searchParams.rtab === "eway" || searchParams.rtab === "e-way" || searchParams.rtab === "eWay") ? "eway" : "dc");
  const isEwayQueue = reverseSubTab === "eway";

  // Reverse pickups stay visible after they are generated — otherwise the row
  // vanishes from this table the moment finance hits "save".
  const rpDcWhere: Prisma.ReversePickupRequestWhereInput = {
    status: { in: ["DC_REQUESTED", "DC_GENERATED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED"] },
  };
  const rpEwayWhere: Prisma.ReversePickupRequestWhereInput = {
    status: { in: ["EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED"] },
  };
  const rpBaseWhere = isEwayQueue ? rpEwayWhere : rpDcWhere;

  const reverseColumnFilters = parseColumnFilters(searchParams, REVERSE_FINANCE_FILTER_KEYS);
  const rpSearch = typeof searchParams.rsearch === "string" ? searchParams.rsearch.trim() : "";
  const rpWhere: Prisma.ReversePickupRequestWhereInput = { ...rpBaseWhere };
  if (rpSearch) {
    rpWhere.OR = [
      { requestNumber: { contains: rpSearch, mode: "insensitive" } },
      { serialNumber: { contains: rpSearch, mode: "insensitive" } },
      { model: { contains: rpSearch, mode: "insensitive" } },
      { employeeName: { contains: rpSearch, mode: "insensitive" } },
      { dcNo: { contains: rpSearch, mode: "insensitive" } },
      { eWayBillNo: { contains: rpSearch, mode: "insensitive" } },
    ];
  }
  if (reverseColumnFilters.rmodel) rpWhere.model = { in: reverseColumnFilters.rmodel };
  if (reverseColumnFilters.remployee) rpWhere.employeeName = { in: reverseColumnFilters.remployee };
  if (reverseColumnFilters.rstatus) rpWhere.status = { in: reverseColumnFilters.rstatus as ReversePickupStatus[] };
  if (reverseColumnFilters.rdc) rpWhere.dcNo = { in: reverseColumnFilters.rdc };
  if (reverseColumnFilters.reway) rpWhere.eWayBillNo = { in: reverseColumnFilters.reway };

  const reverseTotalCount = await prisma.reversePickupRequest.count({ where: rpWhere });
  const reverseTotalPages = Math.max(1, Math.ceil(reverseTotalCount / rlimit));
  const safeReversePage = Math.min(rpage, reverseTotalPages);

  const [rpRequests, rpModelGroups, rpEmployeeGroups, rpStatusGroups, rpDcGroups, rpEwayGroups] = await Promise.all([
    prisma.reversePickupRequest.findMany({
      where: rpWhere,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (safeReversePage - 1) * rlimit,
      take: rlimit,
    }),
    prisma.reversePickupRequest.groupBy({ by: ["model"], where: rpWhere, _count: { _all: true } }),
    prisma.reversePickupRequest.groupBy({ by: ["employeeName"], where: rpWhere, _count: { _all: true } }),
    prisma.reversePickupRequest.groupBy({ by: ["status"], where: rpWhere, _count: { _all: true } }),
    prisma.reversePickupRequest.groupBy({ by: ["dcNo"], where: rpWhere, _count: { _all: true } }),
    prisma.reversePickupRequest.groupBy({ by: ["eWayBillNo"], where: rpWhere, _count: { _all: true } }),
  ]);

  const reverseColumnFilterValues: Record<string, { value: string; count: number }[]> = {
    rmodel: rpModelGroups.map(r => ({ value: r.model ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    remployee: rpEmployeeGroups.map(r => ({ value: r.employeeName ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    rstatus: rpStatusGroups.map(r => ({ value: r.status ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    rdc: rpDcGroups.map(r => ({ value: r.dcNo ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    reway: rpEwayGroups.map(r => ({ value: r.eWayBillNo ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
  };

  // Badge = cases still waiting on finance across both queues, independent of
  // which queue (and which page) is currently open.
  const reversePending = await prisma.reversePickupRequest.count({
    where: { status: { in: ["DC_REQUESTED", "EWAY_BILL_REQUESTED"] } },
  });

  const rpDcIds = await prisma.deliveryChallan.findMany({
    where: { reversePickupRequestId: { in: rpRequests.map(r => r.id) } },
    select: { id: true, reversePickupRequestId: true },
  });
  const rpDcMap = new Map<string, string>(
    rpDcIds.filter((dc): dc is typeof dc & { reversePickupRequestId: string } => dc.reversePickupRequestId !== null)
      .map(dc => [dc.reversePickupRequestId, dc.id])
  );

  const forwardOrdersToShow = orders;

  // Sub-tab links keep search / filters / reverse state and only reset the
  // page, so switching tabs never silently drops the active view.
  const subTabHref = (ftab: "dc" | "eway") => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") params.set(key, value);
    }
    params.set("ftab", ftab);
    params.delete("page");
    params.delete("rpage");
    params.delete("selected");
    return `/dashboard/finance?${params.toString()}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Finance Module</h1>
          <p className="text-muted-foreground mt-2">
            Generate Delivery Challans and E-Way bills for orders.
          </p>
        </div>
        <FinanceExportButton />
      </div>

      <ForwardReverseTabs reverseCount={reversePending} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-100">
            <FileText className="size-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Pending DC</p>
            <p className="text-2xl font-bold text-primary mt-1">{pendingDC}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100">
            <FileText className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Orders</p>
            <p className="text-2xl font-bold text-primary mt-1">{pipelineTotalCount}</p>
          </div>
        </div>
      </div>

      {activeTab === "forward" ? (
        <div className="space-y-4">
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            <a
              href={subTabHref("dc")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${subTab === "dc" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              DC
            </a>
            <a
              href={subTabHref("eway")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${subTab === "eway" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              E-Way Bill
            </a>
          </div>

          {forwardOrdersToShow.length === 0 ? (
            <div className="p-8 rounded-xl glass text-center text-muted-foreground">
              {subTab === "dc" ? "No DC requests to process." : "No E-Way Bill requests to process."}
            </div>
          ) : (
            <>
              <FinanceOrderTable orders={forwardOrdersToShow} canManage={canManage} selectedId={selectedId} columnFilterValues={columnFilterValues} financeSubTab={subTab} />
              <PaginationBar basePath="/dashboard/finance" currentPage={safePage} totalPages={totalPages} totalCount={totalCount} limit={limit} />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ReversePickupFinanceSection
            requests={rpRequests}
            canManage={canManage}
            dcIdMap={rpDcMap}
            reverseSubTab={reverseSubTab}
            totalCount={reverseTotalCount}
            columnFilterValues={reverseColumnFilterValues}
          />
          {reverseTotalCount > 0 && (
            <PaginationBar basePath="/dashboard/finance" currentPage={safeReversePage} totalPages={reverseTotalPages} totalCount={reverseTotalCount} limit={rlimit} pageParam="rpage" limitParam="rlimit" />
          )}
        </div>
      )}
    </div>
  );
}
