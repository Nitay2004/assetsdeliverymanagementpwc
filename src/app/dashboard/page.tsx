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
} from "lucide-react";
import Link from "next/link";
import { QuickStat } from "@/components/dashboard/quick-stat";
import { OrderPipeline } from "@/components/dashboard/order-pipeline";
import { RecentActivity } from "@/components/dashboard/recent-activity";

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
  PAYMENT_RECEIVED: { label: "Paid", color: "#059669" },
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

export default async function DashboardPage() {
  const user = await getSession();

  // Fetch all data in parallel
  const [orders, inventoryItems, recentOrders, recentInventory] = await Promise.all([
    prisma.order.findMany({
      include: { assets: true },
    }),
    prisma.inventoryItem.findMany(),
    prisma.order.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.inventoryItem.findMany({
      where: { status: "ALLOCATED" },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  // Compute stats
  const totalOrders = orders.length;
  const activeOrders = orders.filter(
    (o) => !["DELIVERED", "DELIVERY_CONFIRMED", "INVOICED", "PAYMENT_RECEIVED", "WARRANTY_UPDATED"].includes(o.status)
  ).length;
  const deliveredOrders = orders.filter(
    (o) => ["DELIVERED", "DELIVERY_CONFIRMED"].includes(o.status)
  ).length;
  const pendingAllocation = orders.filter((o) => o.status === "ORDER_PLACED").length;
  const inTransit = orders.filter(
    (o) => o.status === "DISPATCHED"
  ).length;

  const totalInventory = inventoryItems.length;
  const availableStock = inventoryItems.filter((i) => i.status === "AVAILABLE").length;
  const allocatedStock = inventoryItems.filter((i) => i.status === "ALLOCATED").length;
  const defectiveStock = inventoryItems.filter((i) => i.status === "DEFECTIVE").length;

  const totalAssets = orders.reduce((sum, o) => sum + o.assets.length, 0);

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
    { label: "Warehouse", href: "/dashboard/warehouse", icon: <Layers className="size-4" />, count: pendingAllocation, desc: "Pending allocation" },
    { label: "Provisioning", href: "/dashboard/provisioning", icon: <Laptop className="size-4" />, count: orders.filter((o) => ["ALLOCATED", "IN_PROVISIONING"].includes(o.status)).length, desc: "In progress" },
    { label: "Finance", href: "/dashboard/finance", icon: <CheckCircle className="size-4" />, count: orders.filter((o) => ["IN_PROVISIONING", "DC_GENERATED", "INVOICED"].includes(o.status)).length, desc: "Pending finance" },
    { label: "Logistics", href: "/dashboard/logistics", icon: <Truck className="size-4" />, count: orders.filter((o) => ["DC_GENERATED", "PACKED_AND_LABELLED", "DISPATCHED"].includes(o.status)).length, desc: "In logistics" },
    { label: "Warranty", href: "/dashboard/warranty", icon: <ShieldCheck className="size-4" />, count: inventoryItems.filter((i) => !i.warrantyPeriod && i.status === "ALLOCATED").length, desc: "Needs warranty" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome back{user?.name ? `, ${user.name}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your asset delivery pipeline.
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickStat
          icon={<Package className="size-5 text-blue-600" />}
          iconBg="bg-blue-100"
          label="Total Orders"
          value={totalOrders}
          subtitle={`${activeOrders} active`}
        />
        <QuickStat
          icon={<Clock className="size-5 text-yellow-600" />}
          iconBg="bg-yellow-100"
          label="Pending Allocation"
          value={pendingAllocation}
          subtitle="Awaiting warehouse"
        />
        <QuickStat
          icon={<Truck className="size-5 text-orange-600" />}
          iconBg="bg-orange-100"
          label="In Transit"
          value={inTransit}
          subtitle="Currently dispatched"
        />
        <QuickStat
          icon={<CheckCircle className="size-5 text-green-600" />}
          iconBg="bg-green-100"
          label="Delivered"
          value={deliveredOrders}
          subtitle="Successfully delivered"
        />
      </div>

      {/* Inventory row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickStat
          icon={<Laptop className="size-5 text-blue-600" />}
          iconBg="bg-blue-50"
          label="Available Stock"
          value={availableStock}
          subtitle={`of ${totalInventory} total`}
        />
        <QuickStat
          icon={<Layers className="size-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
          label="Allocated"
          value={allocatedStock}
          subtitle={`${totalAssets} order assets`}
        />
        {defectiveStock > 0 ? (
          <QuickStat
            icon={<AlertTriangle className="size-5 text-red-500" />}
            iconBg="bg-red-50"
            label="Defective"
            value={defectiveStock}
            subtitle="Needs attention"
          />
        ) : (
          <QuickStat
            icon={<ShieldCheck className="size-5 text-green-600" />}
            iconBg="bg-green-50"
            label="Defective"
            value={0}
            subtitle="All clear ✓"
          />
        )}
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
              <OrderPipeline data={pipelineData} total={totalOrders} />
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
