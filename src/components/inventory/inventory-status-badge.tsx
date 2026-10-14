const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-purple-100 text-purple-700",
  AVAILABLE: "bg-green-100 text-green-700",
  QC_PENDING: "bg-amber-100 text-amber-700",
  ALLOCATED: "bg-blue-100 text-blue-700",
  DEFECTIVE: "bg-red-100 text-red-700",
  RETIRED: "bg-slate-100 text-slate-700",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  AVAILABLE: "Available",
  QC_PENDING: "QC Pending",
  ALLOCATED: "Allocated",
  DEFECTIVE: "Defective",
  RETIRED: "Retired",
};

export function InventoryStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
