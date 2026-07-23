import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { FinanceOrderTable } from "@/components/finance/finance-order-table";
import { ScrollToItem } from "@/components/shared/scroll-to-item";
import { ReversePickupFinanceSection } from "@/components/finance/reverse-pickup-finance-section";
import { FinanceExportButton } from "@/components/finance/finance-export-button";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCorrectOrderPage } from "@/lib/order-page";
import type { OrderStatus, Prisma } from "@prisma/client";

const STATUS_FILTER: OrderStatus[] = ["IN_PROVISIONING", "DC_REQUESTED", "DC_GENERATED", "PACKED_AND_LABELLED", "DOCKET_ASSIGNED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED", "DISPATCHED", "DELIVERED", "RTO", "RTO_DC_REQUESTED", "RTO_DC_GENERATED", "RTO_EWAY_BILL_REQUESTED", "RTO_EWAY_BILL_GENERATED", "DELIVERY_CONFIRMED"];

export default async function FinancePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "10", 10) || 10));
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "FINANCE"));

  if (selectedId) {
    const correctPage = await getCorrectOrderPage(selectedId, STATUS_FILTER, limit);
    if (correctPage && correctPage !== page) {
      redirect(`/dashboard/finance?page=${correctPage}&limit=${limit}&selected=${selectedId}`);
    }
  }

  const baseWhere: Prisma.OrderWhereInput = { status: { in: STATUS_FILTER } };
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

  const totalCount = await prisma.order.count({ where });
  const rawOrders = await prisma.order.findMany({
    where,
    include: {
      deliveryChallans: {
        include: { items: true, warehouse: true },
        orderBy: { createdAt: "desc" },
      },
      dockets: { orderBy: { createdAt: "desc" } },
      assets: {
        include: { inventoryItem: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * limit,
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

  const pendingDC = rawOrders.filter(o => o.status === "IN_PROVISIONING" || o.status === "DC_REQUESTED" || o.status === "RTO_DC_REQUESTED").length;

  const rpRequests = await prisma.reversePickupRequest.findMany({
    where: { status: { in: ["DC_REQUESTED", "EWAY_BILL_REQUESTED"] } },
    orderBy: { createdAt: "desc" },
  });

  const rpDcIds = await prisma.deliveryChallan.findMany({
    where: { reversePickupRequestId: { in: rpRequests.map(r => r.id) } },
    select: { id: true, reversePickupRequestId: true },
  });
  const rpDcMap = new Map<string, string>(
    rpDcIds.filter((dc): dc is typeof dc & { reversePickupRequestId: string } => dc.reversePickupRequestId !== null)
      .map(dc => [dc.reversePickupRequestId, dc.id])
  );

  const rpDcRequests = rpRequests.filter(r => r.status === "DC_REQUESTED");
  const rpEwayRequests = rpRequests.filter(r => r.status === "EWAY_BILL_REQUESTED");

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);

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
            <p className="text-2xl font-bold text-primary mt-1">{totalCount}</p>
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="p-8 rounded-xl glass text-center text-muted-foreground">
          No orders ready for finance processing.
        </div>
      ) : (
        <>
          <FinanceOrderTable orders={orders} canManage={canManage} selectedId={selectedId} />
          <PaginationBar basePath="/dashboard/finance" currentPage={safePage} totalPages={totalPages} totalCount={totalCount} limit={limit} />
        </>
      )}

      <ReversePickupFinanceSection
        dcRequests={rpDcRequests}
        ewayRequests={rpEwayRequests}
        canManage={canManage}
        dcIdMap={rpDcMap}
      />
    </div>
  );
}
