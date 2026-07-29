import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  Package,
  Truck,
  Clock,
  CheckCircle,
  Laptop,
  ShieldCheck,
  ArrowRight,
  Layers,
  AlertTriangle,
  Users,
  Target,
  XCircle,
  Warehouse,
  ClipboardCheck,
} from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import Link from "next/link";
import { QuickStat } from "@/components/dashboard/quick-stat";
import { OrderPipeline } from "@/components/dashboard/order-pipeline";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TotalStockCard } from "@/components/dashboard/total-stock-card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { OrderStatCard } from "@/components/dashboard/order-stat-card";
import { ReverseStatCard } from "@/components/dashboard/reverse-stat-card";
import { CancelledReverseStatCard } from "@/components/dashboard/cancelled-reverse-stat-card";
import { InventorySlaStatCard } from "@/components/dashboard/inventory-sla-stat-card";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ORDER_PLACED: { label: "Order Placed", color: "#eab308" },
  ALLOCATED: { label: "Allocated", color: "#3b82f6" },
  IN_PROVISIONING: { label: "Provisioning", color: "#a855f7" },
  DC_GENERATED: { label: "DC Generated", color: "#6366f1" },
  PACKED_AND_LABELLED: { label: "Packed", color: "#8b5cf6" },
  DOCKET_ASSIGNED: { label: "Docketed", color: "#06b6d4" },
  EWAY_BILL_REQUESTED: { label: "E-Way Req", color: "#14b8a6" },
  EWAY_BILL_GENERATED: { label: "E-Way Gen", color: "#10b981" },
  DISPATCHED: { label: "Dispatched", color: "#f97316" },
  DELIVERED: { label: "Delivered", color: "#22c55e" },
  DELIVERY_CONFIRMED: { label: "Confirmed", color: "#16a34a" },
  INVOICED: { label: "Invoiced", color: "#0ea5e9" },
  WARRANTY_UPDATED: { label: "Warranty", color: "#7c3aed" },
};

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function DashboardPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSession();
  const searchParams = await props.searchParams;
  const fromRaw = typeof searchParams.from === "string" ? searchParams.from : undefined;
  const toRaw = typeof searchParams.to === "string" ? searchParams.to : undefined;

  const dateFilter: Record<string, Date> = {};
  if (fromRaw) dateFilter.gte = new Date(fromRaw);
  if (toRaw) {
    const end = new Date(toRaw);
    end.setDate(end.getDate() + 1);
    dateFilter.lt = end;
  }
  const createdAt = Object.keys(dateFilter).length ? dateFilter : undefined;
  const orderWhere = createdAt ? { createdAt } : undefined;
  const inventoryWhere = createdAt ? { createdAt } : undefined;
  const reverseWhere = createdAt ? { createdAt } : undefined;

  // Fetch all data in parallel
  const [orders, inventoryItems, recentOrders, recentInventory, reversePickups, deliveredInventoryCount] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      include: { assets: true },
    }),
    prisma.inventoryItem.findMany({
      where: inventoryWhere,
    }),
    prisma.order.findMany({
      where: orderWhere,
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.inventoryItem.findMany({
      where: { ...(inventoryWhere ?? {}), status: "ALLOCATED" },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.reversePickupRequest.findMany({
      where: reverseWhere,
    }),
    prisma.inventoryItem.count({
      where: {
        status: "ALLOCATED",
        OR: [
          { trackingStatus: { contains: "shipped to user", mode: "insensitive" } },
          { trackingStatus: { contains: "delivered", mode: "insensitive" } },
          { trackingSubStatus: { contains: "shipped to user", mode: "insensitive" } },
          { trackingSubStatus: { contains: "delivered", mode: "insensitive" } },
        ],
      },
    }),
  ]);

  // Compute stats
  const inProvisioningCount = orders.filter(o => o.status === "IN_PROVISIONING").length;
  const pendingAllocationCount = orders.filter(o => o.status === "ORDER_PLACED").length;
  const inTransitCount = orders.filter(o => o.status === "DISPATCHED").length;
  const packedAndLabelledCount = orders.filter(o => o.status === "PACKED_AND_LABELLED").length + deliveredInventoryCount;
  const deliveredCount = orders.filter(o => ["DELIVERED", "DELIVERY_CONFIRMED"].includes(o.status)).length + deliveredInventoryCount;
  const rtoCount = orders.filter(o => ["RTO", "RTO_DC_REQUESTED", "RTO_DC_GENERATED", "RTO_EWAY_BILL_REQUESTED", "RTO_EWAY_BILL_GENERATED", "RTO_IN_TRANSIT", "RTO_DELIVERED_TO_WAREHOUSE"].includes(o.status)).length;

  const totalInventory = inventoryItems.length;
  const newStock = inventoryItems.filter((i) => i.status === "NEW").length;
  const availableStock = inventoryItems.filter((i) => i.status === "AVAILABLE").length;
  const allocatedStock = inventoryItems.filter((i) => i.status === "ALLOCATED").length;
  const slaMetCount = inventoryItems.filter((i) => i.slaStatus?.toLowerCase() === "met").length;
  const slaMissedCount = inventoryItems.filter((i) => i.slaStatus?.toLowerCase() === "missed").length;

  const totalAssets = orders.reduce((sum, o) => sum + o.assets.length, 0);

  // Reverse Shipment stats
  const reversePickupCount = reversePickups.length;
  const reversePickupsDone = reversePickups.filter((r) => ["PICKED_UP", "COMPLETED"].includes(r.status)).length;
  const reversePickupsCancelled = reversePickups.filter((r) => r.remark?.toLowerCase().includes("cancel")).length;
  const reverseInTransit = reversePickups.filter((r) => ["DOCKET_REQUESTED", "INSPECTED"].includes(r.status)).length;
  const reverseReceivedInWh = reversePickups.filter((r) => r.status === "RECEIVED_AT_WAREHOUSE").length;
  const reverseAlignQc = reversePickups.filter((r) => ["DC_REQUESTED", "QC_COMPLETED", "DC_GENERATED"].includes(r.status)).length;
  const reverseSlaMet = reversePickups.filter((r) => r.sla?.toLowerCase() === "met").length;
  const reverseSlaMissed = reversePickups.filter((r) => r.sla?.toLowerCase() === "missed").length;

  // Group inventory items by invoicing warehouse
  const warehouseMap = new Map<string, number>();
  let unallocatedCount = 0;
  for (const item of inventoryItems) {
    const wh = item.invoicingWarehouse?.trim();
    if (wh) {
      warehouseMap.set(wh, (warehouseMap.get(wh) || 0) + 1);
    } else {
      unallocatedCount++;
    }
  }

  const stockByWarehouse = Array.from(warehouseMap.entries())
    .sort((a, b) => b[1] - a[1]);

  // Pipeline data
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const pipelineData = Object.entries(STATUS_CONFIG)
    .filter(([key]) => statusCounts[key])
    .map(([key, cfg]) => ({
      status: cfg.label,
      count: statusCounts[key] || 0,
      color: cfg.color,
    }));

  // Recent activity
  const activities = [
    ...recentOrders.map((o) => ({
      id: `order-${o.id}`,
      message: `Order for ${o.clientName} → ${o.deliveryLocation} (${STATUS_CONFIG[o.status]?.label ?? o.status})`,
      time: timeAgo(o.updatedAt),
      module: "Orders",
      href: `/dashboard/warehouse?selected=${o.id}`,
    })),
    ...recentInventory.map((i) => ({
      id: `inv-${i.id}`,
      message: `${i.model} (${i.serialNumber}) assigned`,
      time: timeAgo(i.updatedAt),
      module: "Inventory",
      href: `/dashboard/inventory?selected=${i.id}`,
    })),
  ]
    .sort((a, b) => {
      // Sort by most recent
      const parseTime = (t: string) => {
        if (t === "just now") return 0;
        const num = parseInt(t);
        if (t.includes("m")) return num;
        if (t.includes("h")) return num * 60;
        return num * 1440;
      };
      return parseTime(a.time) - parseTime(b.time);
    })
    .slice(0, 8);

  // Quick-links for modules
  const modules = [
    { label: "Inventory", href: "/dashboard/inventory", icon: <Package className="size-4" />, count: totalInventory, desc: "Total items" },
    { label: "Assigned Assets", href: "/dashboard/assigned-assets", icon: <Users className="size-4" />, count: allocatedStock, desc: "Allocated to users" },
    { label: "Warehouse", href: "/dashboard/warehouse", icon: <Layers className="size-4" />, count: pendingAllocationCount, desc: "Pending allocation" },
    { label: "Provisioning", href: "/dashboard/provisioning", icon: <Laptop className="size-4" />, count: orders.filter((o) => ["ALLOCATED", "IN_PROVISIONING"].includes(o.status)).length, desc: "In progress" },
    { label: "Finance", href: "/dashboard/finance", icon: <CheckCircle className="size-4" />, count: orders.filter((o) => ["IN_PROVISIONING", "DC_GENERATED", "INVOICED"].includes(o.status)).length, desc: "Pending finance" },
    { label: "Logistics", href: "/dashboard/logistics", icon: <Truck className="size-4" />, count: orders.filter((o) => ["DC_GENERATED", "PACKED_AND_LABELLED", "DISPATCHED"].includes(o.status)).length, desc: "In logistics" },
    { label: "Warranty", href: "/dashboard/warranty", icon: <ShieldCheck className="size-4" />, count: inventoryItems.filter((i) => !i.warrantyPeriod && i.status === "ALLOCATED").length, desc: "Needs warranty" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s an overview of your asset delivery pipeline.
          </p>
        </div>
        <DateRangePicker />
      </div>

      {/* Inventory Section */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Inventory</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TotalStockCard totalInventory={totalInventory} stockByWarehouse={stockByWarehouse} unallocatedCount={unallocatedCount} href="/dashboard/inventory" />
          <QuickStat
            icon={<Laptop className="size-5 text-purple-600" />}
            iconBg="bg-purple-50"
            label="New Stock"
            value={newStock}
            subtitle="Brand new laptops"
            href="/dashboard/inventory"
          />
          <QuickStat
            icon={<Laptop className="size-5 text-blue-600" />}
            iconBg="bg-blue-50"
            label="Re-deployment Inventory"
            value={availableStock}
            subtitle={`of ${totalInventory} total`}
            href="/dashboard/inventory"
          />
          <QuickStat
            icon={<Layers className="size-5 text-indigo-600" />}
            iconBg="bg-indigo-50"
            label="Assets Allocated to Users"
            value={allocatedStock}
            subtitle={`${totalAssets} order assets`}
            href="/dashboard/inventory"
          />
        </div>
      </div>

      {/* Forward Shipment Section */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Forward Shipment</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OrderStatCard
          icon={<Clock className="size-5 text-yellow-600" />}
          iconBg="bg-yellow-100"
          label="In Warehouse Allocation"
          value={pendingAllocationCount}
          subtitle="Awaiting warehouse"
          modalTitle="Pending Allocation Orders"
          modalIcon={<Clock className="size-5 text-yellow-600" />}
          modalIconBg="bg-yellow-100"
          statuses={["ORDER_PLACED"]}
        />
        <OrderStatCard
          icon={<Clock className="size-5 text-purple-600" />}
          iconBg="bg-purple-100"
          label="In Provisioning"
          value={inProvisioningCount}
          subtitle="Awaiting OS install"
          modalTitle="In Provisioning Orders"
          modalIcon={<Clock className="size-5 text-purple-600" />}
          modalIconBg="bg-purple-100"
          statuses={["IN_PROVISIONING"]}
        />
        <OrderStatCard
          icon={<Package className="size-5 text-violet-600" />}
          iconBg="bg-violet-100"
          label="Packed & Labelled"
          value={packedAndLabelledCount}
          subtitle="Ready for dispatch"
          modalTitle="Packed & Labelled Orders"
          modalIcon={<Package className="size-5 text-violet-600" />}
          modalIconBg="bg-violet-100"
          statuses={["PACKED_AND_LABELLED"]}
          inventoryTrackingKeywords={["shipped to user", "delivered"]}
        />
        <OrderStatCard
          icon={<Truck className="size-5 text-orange-600" />}
          iconBg="bg-orange-100"
          label="In Transit"
          value={inTransitCount}
          subtitle="Currently dispatched"
          modalTitle="In Transit Orders"
          modalIcon={<Truck className="size-5 text-orange-600" />}
          modalIconBg="bg-orange-100"
          statuses={["DISPATCHED"]}
        />
        <OrderStatCard
          icon={<CheckCircle className="size-5 text-green-600" />}
          iconBg="bg-green-100"
          label="Delivered"
          value={deliveredCount}
          subtitle="Successfully delivered"
          modalTitle="Delivered Orders"
          modalIcon={<CheckCircle className="size-5 text-green-600" />}
          modalIconBg="bg-green-100"
          statuses={["DELIVERED", "DELIVERY_CONFIRMED"]}
          inventoryTrackingKeywords={["shipped to user", "delivered"]}
        />
        <OrderStatCard
          icon={<AlertTriangle className="size-5 text-red-500" />}
          iconBg="bg-red-50"
          label="RTO"
          value={rtoCount}
          subtitle="Return to origin"
          modalTitle="RTO Orders"
          modalIcon={<AlertTriangle className="size-5 text-red-500" />}
          modalIconBg="bg-red-50"
          statuses={["RTO", "RTO_DC_REQUESTED", "RTO_DC_GENERATED", "RTO_EWAY_BILL_REQUESTED", "RTO_EWAY_BILL_GENERATED", "RTO_IN_TRANSIT", "RTO_DELIVERED_TO_WAREHOUSE"]}
        />
          <InventorySlaStatCard
            icon={<CheckCircle className="size-5 text-green-600" />}
            iconBg="bg-green-50"
            label="SLA Met"
            value={slaMetCount}
            subtitle="Within TAT"
            modalTitle="SLA Met Items"
            modalIcon={<CheckCircle className="size-5 text-green-600" />}
            modalIconBg="bg-green-50"
            slaValue="MET"
          />
          <InventorySlaStatCard
            icon={<AlertTriangle className="size-5 text-red-500" />}
            iconBg="bg-red-50"
            label="SLA Missed"
            value={slaMissedCount}
            subtitle="Beyond TAT"
            modalTitle="SLA Missed Items"
            modalIcon={<AlertTriangle className="size-5 text-red-500" />}
            modalIconBg="bg-red-50"
            slaValue="MISSED"
        />
        </div>
      </div>

      {/* Reverse Shipment Section */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Reverse Shipment</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReverseStatCard
            icon={<Target className="size-5 text-blue-600" />}
            iconBg="bg-blue-50"
            label="Total Request"
            value={reversePickupCount}
            subtitle="All reverse requests"
            modalTitle="All Reverse Requests"
            modalIcon={<Target className="size-5 text-blue-600" />}
            modalIconBg="bg-blue-50"
            statuses={["REQUESTED", "PARTNER_ASSIGNED", "DOCKET_REQUESTED", "INSPECTED", "PICKED_UP", "RECEIVED_AT_WAREHOUSE", "QC_COMPLETED", "DC_REQUESTED", "DC_GENERATED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED", "BLANCO_CERTIFIED", "COMPLETED"]}
          />
          <ReverseStatCard
            icon={<CheckCircle className="size-5 text-green-600" />}
            iconBg="bg-green-50"
            label="Pick-ups Done"
            value={reversePickupsDone}
            subtitle="Successfully picked"
            modalTitle="Pick-ups Done"
            modalIcon={<CheckCircle className="size-5 text-green-600" />}
            modalIconBg="bg-green-50"
            statuses={["PICKED_UP", "COMPLETED"]}
          />
          <CancelledReverseStatCard
            icon={<XCircle className="size-5 text-red-500" />}
            iconBg="bg-red-50"
            label="Pick-ups Cancelled"
            value={reversePickupsCancelled}
            subtitle="Cancelled requests"
            modalTitle="Cancelled Pick-ups"
            modalIcon={<XCircle className="size-5 text-red-500" />}
            modalIconBg="bg-red-50"
          />
          <ReverseStatCard
            icon={<Truck className="size-5 text-cyan-600" />}
            iconBg="bg-cyan-50"
            label="In-Transit"
            value={reverseInTransit}
            subtitle="On the way to warehouse"
            modalTitle="In-Transit Requests"
            modalIcon={<Truck className="size-5 text-cyan-600" />}
            modalIconBg="bg-cyan-50"
            statuses={["DOCKET_REQUESTED", "INSPECTED"]}
          />
          <ReverseStatCard
            icon={<Warehouse className="size-5 text-emerald-600" />}
            iconBg="bg-emerald-50"
            label="Received in Warehouse"
            value={reverseReceivedInWh}
            subtitle="Reached warehouse"
            modalTitle="Received in Warehouse"
            modalIcon={<Warehouse className="size-5 text-emerald-600" />}
            modalIconBg="bg-emerald-50"
            statuses={["RECEIVED_AT_WAREHOUSE"]}
          />
          <ReverseStatCard
            icon={<ClipboardCheck className="size-5 text-violet-600" />}
            iconBg="bg-violet-50"
            label="Align for QC & Blancco"
            value={reverseAlignQc}
            subtitle="Ready for QC process"
            modalTitle="Align for QC & Blancco"
            modalIcon={<ClipboardCheck className="size-5 text-violet-600" />}
            modalIconBg="bg-violet-50"
            statuses={["DC_REQUESTED", "QC_COMPLETED", "DC_GENERATED"]}
          />
          <ReverseStatCard
            icon={<CheckCircle className="size-5 text-green-600" />}
            iconBg="bg-green-50"
            label="SLA Met"
            value={reverseSlaMet}
            subtitle="Within TAT"
            modalTitle="SLA Met Requests"
            modalIcon={<CheckCircle className="size-5 text-green-600" />}
            modalIconBg="bg-green-50"
            statuses={["REQUESTED", "PARTNER_ASSIGNED", "DOCKET_REQUESTED", "INSPECTED", "PICKED_UP", "RECEIVED_AT_WAREHOUSE", "QC_COMPLETED", "DC_REQUESTED", "DC_GENERATED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED", "BLANCO_CERTIFIED", "COMPLETED"]}
          />
          <ReverseStatCard
            icon={<AlertTriangle className="size-5 text-red-500" />}
            iconBg="bg-red-50"
            label="SLA Missed"
            value={reverseSlaMissed}
            subtitle="Beyond TAT"
            modalTitle="SLA Missed Requests"
            modalIcon={<AlertTriangle className="size-5 text-red-500" />}
            modalIconBg="bg-red-50"
            statuses={["REQUESTED", "PARTNER_ASSIGNED", "DOCKET_REQUESTED", "INSPECTED", "PICKED_UP", "RECEIVED_AT_WAREHOUSE", "QC_COMPLETED", "DC_REQUESTED", "DC_GENERATED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED", "BLANCO_CERTIFIED", "COMPLETED"]}
          />
        </div>
      </div>

      {/* Pipeline + Activity */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Order Pipeline */}
        <div className="lg:col-span-3 rounded-xl glass shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-black/5">
            <h2 className="text-lg font-semibold text-foreground">Order Pipeline</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Distribution across delivery stages</p>
          </div>
          <div className="p-6">
            {pipelineData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No orders to display.</p>
            ) : (
              <OrderPipeline data={pipelineData} total={orders.length} />
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl glass shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-black/5">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Latest updates across modules</p>
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            <RecentActivity activities={activities} />
          </div>
        </div>
      </div>

      {/* Module quick-links */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Access</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="group flex items-center gap-4 p-4 rounded-xl glass shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                {mod.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{mod.label}</p>
                <p className="text-xs text-muted-foreground">{mod.count} {mod.desc}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
