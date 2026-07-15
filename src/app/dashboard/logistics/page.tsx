import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Package, Truck, ClipboardList, FileText, Hash } from "lucide-react";
import { LogisticsTable } from "@/components/logistics/logistics-table";
import { ReversePickupDocketSection } from "@/components/logistics/reverse-pickup-docket-section";
import { LogisticsExportButton } from "@/components/logistics/logistics-export-button";
import { getWarehouses } from "@/app/actions/dc";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCorrectOrderPage } from "@/lib/order-page";
import type { OrderStatus } from "@prisma/client";

const STATUS_FILTER: OrderStatus[] = ["IN_PROVISIONING", "DOCKET_ASSIGNED", "DC_REQUESTED", "DC_GENERATED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED", "PACKED_AND_LABELLED", "DISPATCHED", "DELIVERED", "RTO", "RTO_DC_REQUESTED", "RTO_DC_GENERATED", "RTO_EWAY_BILL_REQUESTED", "RTO_EWAY_BILL_GENERATED", "RTO_IN_TRANSIT", "RTO_DELIVERED_TO_WAREHOUSE"];

export default async function LogisticsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "10", 10) || 10));
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "LOGISTICS"));

  if (selectedId) {
    const correctPage = await getCorrectOrderPage(selectedId, STATUS_FILTER, limit);
    if (correctPage && correctPage !== page) {
      redirect(`/dashboard/logistics?page=${correctPage}&limit=${limit}&selected=${selectedId}`);
    }
  }

  const totalCount = await prisma.order.count({ where: { status: { in: STATUS_FILTER } } });
  const rawOrders = await prisma.order.findMany({
    where: { status: { in: STATUS_FILTER } },
    include: {
      dockets: { orderBy: { createdAt: "desc" } },
      assets: { include: { inventoryItem: true } },
      deliveryChallans: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      rtoRecords: true,
    },
    orderBy: { updatedAt: "desc" },
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

  const needsDocket = rawOrders.filter(o => o.status === "IN_PROVISIONING").length;
  const awaitingFinance = rawOrders.filter(o => ["DOCKET_ASSIGNED", "DC_REQUESTED", "EWAY_BILL_REQUESTED", "RTO_DC_REQUESTED", "RTO_EWAY_BILL_REQUESTED"].includes(o.status)).length;
  const readyToPack = rawOrders.filter(o => ["DC_GENERATED", "EWAY_BILL_GENERATED", "RTO_DC_GENERATED", "RTO_EWAY_BILL_GENERATED"].includes(o.status)).length;
  const inTransit = rawOrders.filter(o => ["DISPATCHED", "DELIVERED", "RTO_IN_TRANSIT", "RTO_DELIVERED_TO_WAREHOUSE"].includes(o.status)).length;

  const warehouses = await getWarehouses();

  const rpDocketRequests = await prisma.reversePickupRequest.findMany({
    where: { status: "DOCKET_REQUESTED" },
    orderBy: { createdAt: "desc" },
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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Logistics Module</h1>
          <p className="text-muted-foreground mt-2">
            Request DC, assign dockets, pack, label, and manage E-Way bills.
          </p>
        </div>
        <LogisticsExportButton />
      </div>

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

      <LogisticsTable orders={serialized} canManage={canManage} warehouses={warehouses} selectedId={selectedId} />

      <PaginationBar basePath="/dashboard/logistics" currentPage={safePage} totalPages={totalPages} totalCount={totalCount} limit={limit} />

      {serializedRp.length > 0 && (
        <ReversePickupDocketSection requests={serializedRp} canManage={canManage} />
      )}
    </div>
  );
}
