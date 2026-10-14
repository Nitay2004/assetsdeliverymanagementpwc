import { STATUS_LABELS } from "@/lib/reverse-pickup-config";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-700",
  PARTNER_ASSIGNED: "bg-indigo-100 text-indigo-700",
  DOCKET_REQUESTED: "bg-cyan-100 text-cyan-700",
  DOCKET_ASSIGNED: "bg-cyan-100 text-cyan-700",
  INSPECTED: "bg-teal-100 text-teal-700",
  PICKED_UP: "bg-purple-100 text-purple-700",
  PICKUP_CANCELLED: "bg-red-100 text-red-700",
  DUPLICATE: "bg-gray-200 text-gray-700",
  ALREADY_SUBMITTED_TO_PWC_OFFICE: "bg-gray-200 text-gray-700",
  PENDING: "bg-amber-100 text-amber-700",
  PWC_CONFIRMATION_AWAITED: "bg-sky-100 text-sky-700",
  GATEPASS_PENDING: "bg-yellow-100 text-yellow-700",
  ALIGN_FOR_PICKUP: "bg-blue-100 text-blue-700",
  IN_TRANSIT: "bg-sky-100 text-sky-700",
  ON_HOLD: "bg-orange-100 text-orange-700",
  RTO_CASE: "bg-red-100 text-red-700",
  LOST_DEVICE: "bg-red-100 text-red-700",
  RECEIVED_AT_WAREHOUSE: "bg-cyan-100 text-cyan-700",
  QC_CLEANED: "bg-indigo-100 text-indigo-700",
  QC_COMPLETED: "bg-blue-100 text-blue-700",
  CASE_LOGGED_WITH_HP: "bg-orange-100 text-orange-700",
  DC_REQUESTED: "bg-violet-100 text-violet-700",
  DC_GENERATED: "bg-violet-100 text-violet-700",
  EWAY_BILL_REQUESTED: "bg-violet-100 text-violet-700",
  EWAY_BILL_GENERATED: "bg-violet-100 text-violet-700",
  BLANCO_CLEARED: "bg-emerald-100 text-emerald-700",
  BLANCO_PURGED: "bg-emerald-100 text-emerald-700",
  BLANCO_CERTIFIED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-green-100 text-green-700",
};

export function ReverseStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
