import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Plus, ArrowLeftRight, Truck, ClipboardCheck, Warehouse, ShieldCheck, FileText, CheckCircle, Clock, Upload } from "lucide-react";
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

const STRING_SEARCH_FIELDS = [
  "requestNumber", "employeeName", "serialNumber", "model", "type",
  "courierName", "partnerName", "warehouseLocation", "displayStatus", "qcResult", "finalDisposition",
] as const;

const ALL_STATUSES = [
  "REQUESTED", "PARTNER_ASSIGNED", "DOCKET_REQUESTED", "INSPECTED",
  "PICKED_UP", "RECEIVED_AT_WAREHOUSE", "QC_COMPLETED", "DC_REQUESTED",
  "DC_GENERATED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED",
  "BLANCO_CERTIFIED", "COMPLETED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "requested",
  PARTNER_ASSIGNED: "partner assigned",
  DOCKET_REQUESTED: "docket requested",
  INSPECTED: "inspected",
  PICKED_UP: "picked up",
  RECEIVED_AT_WAREHOUSE: "received at warehouse",
  QC_COMPLETED: "qc completed",
  DC_REQUESTED: "dc requested",
  DC_GENERATED: "dc generated",
  EWAY_BILL_REQUESTED: "eway bill requested",
  EWAY_BILL_GENERATED: "eway bill generated",
  BLANCO_CERTIFIED: "blanco certified",
  COMPLETED: "completed",
};

export default async function ReversePickupPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string }>;
}) {
  const params = await searchParams;
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "REVERSE_PICKUP"));

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(params.limit ?? "25", 10) || 25));
  const search = (params.search ?? "").trim();
  const skip = (page - 1) * limit;

  const searchFilter = search
    ? {
        OR: [
          ...STRING_SEARCH_FIELDS.map((field) => ({
            [field]: { contains: search, mode: "insensitive" as const },
          })),
          ...ALL_STATUSES
            .filter((s) => STATUS_LABELS[s]?.includes(search.toLowerCase()) || s.includes(search.toUpperCase()))
            .map((s) => ({ status: s as any })),
        ],
      }
    : {};

  const where = { ...searchFilter };

  const [requests, totalCount] = await Promise.all([
    prisma.reversePickupRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.reversePickupRequest.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const allRequests = await prisma.reversePickupRequest.findMany({
    select: { status: true },
  });

  const pendingCount = allRequests.filter(r =>
    ["REQUESTED", "PARTNER_ASSIGNED", "INSPECTED", "PICKED_UP"].includes(r.status)
  ).length;
  const atWarehouse = allRequests.filter(r =>
    ["RECEIVED_AT_WAREHOUSE", "QC_COMPLETED"].includes(r.status)
  ).length;
  const completedCount = allRequests.filter(r =>
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
            <>
              <Link
                href="/dashboard/reverse-pickup/import"
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-accent active:translate-y-press"
              >
                <Upload className="size-4" />
                Import
              </Link>
              <Link
                href="/dashboard/reverse-pickup/add"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-press"
              >
                <Plus className="size-4" />
                New Request
              </Link>
            </>
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
            <p className="text-2xl font-bold text-primary mt-1">{allRequests.length}</p>
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
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
      />
    </div>
  );
}
