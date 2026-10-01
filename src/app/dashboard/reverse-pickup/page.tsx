import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Plus, ArrowLeftRight, Truck, ClipboardCheck, Warehouse, ShieldCheck, FileText, CheckCircle, Clock, Upload } from "lucide-react";
import Link from "next/link";
import { ReversePickupTable } from "@/components/reverse-pickup/reverse-pickup-table";
import { ReversePickupExportButton } from "@/components/reverse-pickup/reverse-pickup-export-button";
import { parseColumnFilters } from "@/lib/column-filters";
import type { Prisma } from "@prisma/client";

const REVERSE_PICKUP_FILTER_KEYS = ["requestNumber", "employeeName", "serialNumber", "model", "type", "status", "dcNo", "docketNumber", "eWayBillNo", "blancoCertificate", "partnerCourier", "createdAt", "requestDateHp", "pickupDate", "podDocument", "actualDeliveryPodDate", "blancoCertificateDate", "qcResult", "zone1", "tier1", "tat", "sla", "cutOffStatus", "expectedPickupDate"];

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  REQUESTED:              { label: "Requested",              color: "bg-yellow-100 text-yellow-700" },
  PARTNER_ASSIGNED:       { label: "Partner Assigned",       color: "bg-blue-100 text-blue-700" },
  INSPECTED:              { label: "Inspected",              color: "bg-indigo-100 text-indigo-700" },
  PICKED_UP:              { label: "Picked Up",              color: "bg-purple-100 text-purple-700" },
  PICKUP_CANCELLED:       { label: "Pickup Cancelled",       color: "bg-red-100 text-red-700" },
  DUPLICATE:              { label: "Duplicate",              color: "bg-gray-200 text-gray-700" },
  ALREADY_SUBMITTED_TO_PWC_OFFICE: { label: "Submitted to PWC Office", color: "bg-slate-100 text-slate-700" },
  PENDING:                { label: "Pending",                color: "bg-orange-100 text-orange-700" },
  PWC_CONFIRMATION_AWAITED: { label: "PwC Confirmation Awaited", color: "bg-amber-100 text-amber-700" },
  GATEPASS_PENDING:       { label: "Gatepass Pending",       color: "bg-teal-100 text-teal-700" },
  ALIGN_FOR_PICKUP:       { label: "Align for Pickup",       color: "bg-cyan-100 text-cyan-700" },
  IN_TRANSIT:             { label: "In Transit",             color: "bg-sky-100 text-sky-700" },
  ON_HOLD:                { label: "On Hold",                color: "bg-zinc-100 text-zinc-700" },
  RTO_CASE:               { label: "RTO Case",               color: "bg-rose-100 text-rose-700" },
  LOST_DEVICE:            { label: "Lost Device",            color: "bg-stone-100 text-stone-700" },
  RECEIVED_AT_WAREHOUSE:  { label: "At Warehouse",           color: "bg-cyan-100 text-cyan-700" },
  QC_CLEANED:             { label: "Clean QC",               color: "bg-lime-100 text-lime-700" },
  QC_COMPLETED:           { label: "QC Completed",           color: "bg-green-100 text-green-700" },
  BLANCO_CERTIFIED:       { label: "Blanco Certified",       color: "bg-teal-100 text-teal-700" },
  COMPLETED:              { label: "Completed",              color: "bg-emerald-100 text-emerald-700" },
};

const STATUS_ICONS: Record<string, typeof Truck> = {
  REQUESTED: Clock,
  PARTNER_ASSIGNED: Truck,
  INSPECTED: ClipboardCheck,
  PICKED_UP: Truck,
  PICKUP_CANCELLED: Clock,
  DUPLICATE: FileText,
  ALREADY_SUBMITTED_TO_PWC_OFFICE: FileText,
  PENDING: Clock,
  PWC_CONFIRMATION_AWAITED: Clock,
  GATEPASS_PENDING: FileText,
  ALIGN_FOR_PICKUP: Truck,
  IN_TRANSIT: Truck,
  ON_HOLD: Clock,
  RTO_CASE: ArrowLeftRight,
  LOST_DEVICE: FileText,
  RECEIVED_AT_WAREHOUSE: Warehouse,
  QC_CLEANED: ShieldCheck,
  QC_COMPLETED: ShieldCheck,
  BLANCO_CERTIFIED: FileText,
  COMPLETED: CheckCircle,
};

const STRING_SEARCH_FIELDS = [
  "requestNumber", "employeeName", "serialNumber", "model", "type",
  "courierName", "partnerName", "warehouseLocation", "displayStatus", "qcResult",
  "qcCleanResult", "qcPurgeResult", "finalDisposition",
] as const;

const ALL_STATUSES = [
  "REQUESTED", "PARTNER_ASSIGNED", "DOCKET_REQUESTED", "DC_REQUESTED",
  "DC_GENERATED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED",
  "INSPECTED", "PICKED_UP", "PICKUP_CANCELLED", "DUPLICATE",
  "ALREADY_SUBMITTED_TO_PWC_OFFICE", "PENDING", "PWC_CONFIRMATION_AWAITED",
  "GATEPASS_PENDING", "ALIGN_FOR_PICKUP", "IN_TRANSIT", "ON_HOLD",
  "RTO_CASE", "LOST_DEVICE",
  "RECEIVED_AT_WAREHOUSE", "QC_CLEANED", "QC_COMPLETED",
  "BLANCO_CERTIFIED", "COMPLETED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "requested",
  PARTNER_ASSIGNED: "partner assigned",
  DOCKET_REQUESTED: "docket requested",
  INSPECTED: "inspected",
  PICKED_UP: "picked up",
  PICKUP_CANCELLED: "pickup cancelled",
  DUPLICATE: "duplicate",
  ALREADY_SUBMITTED_TO_PWC_OFFICE: "already submitted to pwc office",
  PENDING: "pending",
  PWC_CONFIRMATION_AWAITED: "pwc confirmation awaited",
  GATEPASS_PENDING: "gatepass pending",
  ALIGN_FOR_PICKUP: "align for pickup",
  IN_TRANSIT: "in transit",
  ON_HOLD: "on hold",
  RTO_CASE: "rto case",
  LOST_DEVICE: "lost device",
  RECEIVED_AT_WAREHOUSE: "received at warehouse",
  QC_CLEANED: "clean qc",
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

  const where = { ...searchFilter } as Prisma.ReversePickupRequestWhereInput;

  const columnFilters = parseColumnFilters(params as Record<string, string | string[] | undefined>, REVERSE_PICKUP_FILTER_KEYS);
  const filterableFields: Record<string, string> = {
    requestNumber: "requestNumber", employeeName: "employeeName", serialNumber: "serialNumber",
    model: "model", type: "type", status: "status", dcNo: "dcNo", docketNumber: "docketNumber",
    eWayBillNo: "eWayBillNo", qcResult: "qcResult",
  };
  if (columnFilters.partnerCourier) where.partnerName = { in: columnFilters.partnerCourier };
  if (columnFilters.blancoCertificate) where.blancoCertificateUrl = { not: null };
  if (columnFilters.podDocument) where.podDocumentUrl = { not: null };
  if (columnFilters.createdAt) {
    const parts = columnFilters.createdAt[0].split("/").map(Number);
    if (parts.length === 3 && parts.every(p => !isNaN(p))) {
      const from = new Date(parts[2], parts[1] - 1, parts[0]);
      if (!isNaN(from.getTime())) {
        const to = new Date(parts[2], parts[1] - 1, parts[0] + 1);
        where.createdAt = { gte: from, lt: to };
      }
    }
  }
  for (const [key, field] of Object.entries(filterableFields)) {
    if (columnFilters[key]) (where as Record<string, unknown>)[field] = { in: columnFilters[key] };
  }
  const dateRangeFilters: Prisma.ReversePickupRequestWhereInput[] = [];
  for (const key of ["requestDateHp", "pickupDate", "actualDeliveryPodDate", "blancoCertificateDate"] as const) {
    const vals = columnFilters[key];
    if (!vals?.length) continue;
    dateRangeFilters.push({
      OR: vals.map(v => {
        const parts = v.split("/").map(Number);
        if (parts.length !== 3 || parts.some(p => isNaN(p))) return {} as Prisma.ReversePickupRequestWhereInput;
        const from = new Date(parts[2], parts[1] - 1, parts[0]);
        if (isNaN(from.getTime())) return {} as Prisma.ReversePickupRequestWhereInput;
        const to = new Date(parts[2], parts[1] - 1, parts[0] + 1);
        return { [key]: { gte: from, lt: to } };
      }),
    });
  }
  if (dateRangeFilters.length > 0) {
    (where as Record<string, unknown>).AND = [
      ...(((where as Record<string, unknown>).AND as unknown[]) ?? []),
      ...dateRangeFilters,
    ];
  }

  const [requests, totalCount] = await Promise.all([
    prisma.reversePickupRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        deliveryChallans: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.reversePickupRequest.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const scalarFields = ["requestNumber", "employeeName", "serialNumber", "model", "type", "status", "dcNo", "docketNumber", "eWayBillNo", "qcResult"] as const;

  const [statusGroups, scalarGroups, blancoGroups, partnerGroups, createdGroups, podGroups, dateGroups] = await Promise.all([
    prisma.reversePickupRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    Promise.all(
      scalarFields.map(field =>
        prisma.reversePickupRequest
          .groupBy({ by: [field], where, _count: { _all: true } })
          .then(rows => rows.map(r => ({
            value: (r as Record<string, unknown>)[field] as string | null,
            count: r._count._all,
          })))
      )
    ),
    prisma.reversePickupRequest.groupBy({
      by: ["blancoCertificateUrl"],
      where,
      _count: { _all: true },
    }),
    prisma.reversePickupRequest.groupBy({
      by: ["courierName", "partnerName"],
      where,
      _count: { _all: true },
    }),
    prisma.reversePickupRequest.groupBy({
      by: ["createdAt"],
      where,
      _count: { _all: true },
    }),
    prisma.reversePickupRequest.groupBy({
      by: ["podDocumentUrl"],
      where,
      _count: { _all: true },
    }),
    Promise.all(
      (["requestDateHp", "pickupDate", "actualDeliveryPodDate", "blancoCertificateDate"] as const).map(field =>
        prisma.reversePickupRequest
          .groupBy({ by: [field], where, _count: { _all: true } })
          .then(rows => rows.map(r => {
            const d = (r as Record<string, unknown>)[field] as Date | null;
            return {
              value: d ? new Date(d).toLocaleDateString("en-GB") : "(Blank)",
              count: r._count._all,
            };
          }))
      )
    ),
  ]);

  const statusCounts = new Map(statusGroups.map(r => [r.status, r._count._all]));
  const statusCount = (...statuses: string[]) =>
    statuses.reduce((sum, s) => sum + (statusCounts.get(s as never) ?? 0), 0);
  const pendingCount = statusCount("REQUESTED", "PARTNER_ASSIGNED", "INSPECTED", "PICKED_UP");
  const atWarehouse = statusCount("RECEIVED_AT_WAREHOUSE", "QC_COMPLETED", "COMPLETED");
  const completedCount = statusCount("BLANCO_CERTIFIED", "COMPLETED");

  const columnFilterValues: Record<string, { value: string; count: number }[]> = {};
  scalarGroups.forEach((rows, i) => {
    const field = scalarFields[i];
    columnFilterValues[field] = rows
      .map(r => ({
        value: r.value ?? "(Blank)",
        count: r.count,
      }))
      .sort((a, b) => a.value.localeCompare(b.value));
  });

  const blancoMap = new Map<string, number>();
  for (const row of blancoGroups) {
    const token = row.blancoCertificateUrl ? "Has Certificate" : "(Blank)";
    blancoMap.set(token, (blancoMap.get(token) ?? 0) + row._count._all);
  }
  columnFilterValues.blancoCertificate = [...blancoMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const podMap = new Map<string, number>();
  for (const row of podGroups) {
    const token = row.podDocumentUrl ? "Has POD" : "(Blank)";
    podMap.set(token, (podMap.get(token) ?? 0) + row._count._all);
  }
  columnFilterValues.podDocument = [...podMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const dateFieldKeys = ["requestDateHp", "pickupDate", "actualDeliveryPodDate", "blancoCertificateDate"] as const;
  dateGroups.forEach((rows, i) => {
    columnFilterValues[dateFieldKeys[i]] = rows
      .map(r => ({ value: r.value, count: r.count }))
      .sort((a, b) => b.value.localeCompare(a.value));
  });

  const partnerMap = new Map<string, number>();
  for (const row of partnerGroups) {
    const token = row.courierName ?? row.partnerName ?? "(Blank)";
    partnerMap.set(token, (partnerMap.get(token) ?? 0) + row._count._all);
  }
  columnFilterValues.partnerCourier = [...partnerMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const dayMap = new Map<string, number>();
  for (const row of createdGroups) {
    const day = new Date(row.createdAt).toLocaleDateString("en-GB");
    dayMap.set(day, (dayMap.get(day) ?? 0) + row._count._all);
  }
  columnFilterValues.createdAt = [...dayMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.value.localeCompare(a.value));

  const serializedRequests = requests.map(r => ({
    ...r,
    dcId: r.deliveryChallans[0]?.id ?? null,
    deliveryChallans: undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    pickupDate: r.pickupDate?.toISOString() ?? null,
    inspectionDate: r.inspectionDate?.toISOString() ?? null,
    receivedDate: r.receivedDate?.toISOString() ?? null,
    qcDate: r.qcDate?.toISOString() ?? null,
    blancoCertificateDate: r.blancoCertificateDate?.toISOString() ?? null,
    requestDateHp: r.requestDateHp?.toISOString() ?? null,
    actualDeliveryPodDate: r.actualDeliveryPodDate?.toISOString() ?? null,
    slaStartDate: r.slaStartDate?.toISOString() ?? null,
    expectedPickupDate: r.expectedPickupDate?.toISOString() ?? null,
    laptopAcceptanceDate: r.laptopAcceptanceDate?.toISOString() ?? null,
  }));

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
            <p className="text-2xl font-bold text-primary mt-1">{totalCount}</p>
          </div>
        </div>
      </div>

      <ReversePickupTable
        requests={serializedRequests}
        canManage={canManage}
        statusStyles={STATUS_STYLES}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
        columnFilterValues={columnFilterValues}
      />
    </div>
  );
}
