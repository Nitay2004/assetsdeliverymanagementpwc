import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Plus, ArrowLeftRight, Truck, ClipboardCheck, Warehouse, ShieldCheck, FileText, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { ReversePickupTable } from "@/components/reverse-pickup/reverse-pickup-table";
import { ReversePickupExportButton } from "@/components/reverse-pickup/reverse-pickup-export-button";

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  REQUESTED:              { label: "Requested",              color: "bg-yellow-100 text-yellow-700" },
  PARTNER_ASSIGNED:       { label: "Partner Assigned",       color: "bg-blue-100 text-blue-700" },
  INSPECTED:              { label: "Inspected",              color: "bg-indigo-100 text-indigo-700" },
  PICKED_UP:              { label: "Picked Up",              color: "bg-purple-100 text-purple-700" },
  RECEIVED_AT_WAREHOUSE:  { label: "At Warehouse",           color: "bg-cyan-100 text-cyan-700" },
  QC_COMPLETED:           { label: "QC Completed",           color: "bg-green-100 text-green-700" },
  BLANCO_CERTIFIED:       { label: "Blanco Certified",       color: "bg-teal-100 text-teal-700" },
  COMPLETED:              { label: "Completed",              color: "bg-emerald-100 text-emerald-700" },
};

const STATUS_ICONS: Record<string, typeof Truck> = {
  REQUESTED: Clock,
  PARTNER_ASSIGNED: Truck,
  INSPECTED: ClipboardCheck,
  PICKED_UP: Truck,
  RECEIVED_AT_WAREHOUSE: Warehouse,
  QC_COMPLETED: ShieldCheck,
  BLANCO_CERTIFIED: FileText,
  COMPLETED: CheckCircle,
};

export default async function ReversePickupPage() {
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "REVERSE_PICKUP"));

  const requests = await prisma.reversePickupRequest.findMany({
    orderBy: { createdAt: "desc" },
  });

  const statusCounts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const pendingCount = requests.filter(r =>
    ["REQUESTED", "PARTNER_ASSIGNED", "INSPECTED", "PICKED_UP"].includes(r.status)
  ).length;
  const atWarehouse = requests.filter(r =>
    ["RECEIVED_AT_WAREHOUSE", "QC_COMPLETED"].includes(r.status)
  ).length;
  const completedCount = requests.filter(r =>
    ["BLANCO_CERTIFIED", "COMPLETED"].includes(r.status)
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reverse Pickup</h1>
          <p className="text-muted-foreground mt-2">
            Manage asset returns from employees — from pickup request to restock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReversePickupExportButton />
          {canManage && (
            <Link
              href="/dashboard/reverse-pickup/add"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-press"
            >
              <Plus className="size-4" />
              New Request
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-100">
            <Clock className="size-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Pending Pickup</p>
            <p className="text-2xl font-bold text-primary mt-1">{pendingCount}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100">
            <Warehouse className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">At Warehouse</p>
            <p className="text-2xl font-bold text-primary mt-1">{atWarehouse}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-100">
            <CheckCircle className="size-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Completed</p>
            <p className="text-2xl font-bold text-primary mt-1">{completedCount}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-100">
            <ArrowLeftRight className="size-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Requests</p>
            <p className="text-2xl font-bold text-primary mt-1">{requests.length}</p>
          </div>
        </div>
      </div>

      <ReversePickupTable
        requests={requests.map(r => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          pickupDate: r.pickupDate?.toISOString() ?? null,
          inspectionDate: r.inspectionDate?.toISOString() ?? null,
          receivedDate: r.receivedDate?.toISOString() ?? null,
          qcDate: r.qcDate?.toISOString() ?? null,
          blancoCertificateDate: r.blancoCertificateDate?.toISOString() ?? null,
        }))}
        canManage={canManage}
        statusStyles={STATUS_STYLES}
      />
    </div>
  );
}
