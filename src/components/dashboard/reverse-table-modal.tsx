"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getReversePickupsByStatus } from "@/app/actions/dashboard";
import type { ReversePickupStatus } from "@prisma/client";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  statuses: ReversePickupStatus[];
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  PARTNER_ASSIGNED: "Partner Assigned",
  DOCKET_REQUESTED: "Docket Requested",
  INSPECTED: "Inspected",
  PICKED_UP: "Picked Up",
  PICKUP_CANCELLED: "Pickup Cancelled",
  DUPLICATE: "Duplicate",
  ALREADY_SUBMITTED_TO_PWC_OFFICE: "Submitted to PWC Office",
  PENDING: "Pending",
  PWC_CONFIRMATION_AWAITED: "PwC Confirmation Awaited",
  GATEPASS_PENDING: "Gatepass Pending",
  ALIGN_FOR_PICKUP: "Align for Pickup",
  IN_TRANSIT: "In Transit",
  ON_HOLD: "On Hold",
  RTO_CASE: "RTO Case",
  LOST_DEVICE: "Lost Device",
  RECEIVED_AT_WAREHOUSE: "Received at Warehouse",
  QC_CLEANED: "Clean QC",
  QC_COMPLETED: "QC Completed",
  DC_REQUESTED: "DC Requested",
  DC_GENERATED: "DC Generated",
  EWAY_BILL_REQUESTED: "E-Way Bill Requested",
  EWAY_BILL_GENERATED: "E-Way Bill Generated",
  BLANCO_CERTIFIED: "Blancco Certified",
  COMPLETED: "Completed",
};

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-yellow-100 text-yellow-700",
  PARTNER_ASSIGNED: "bg-orange-100 text-orange-700",
  DOCKET_REQUESTED: "bg-cyan-100 text-cyan-700",
  INSPECTED: "bg-blue-100 text-blue-700",
  PICKED_UP: "bg-green-100 text-green-700",
  PICKUP_CANCELLED: "bg-red-100 text-red-700",
  DUPLICATE: "bg-gray-200 text-gray-700",
  ALREADY_SUBMITTED_TO_PWC_OFFICE: "bg-slate-100 text-slate-700",
  PENDING: "bg-orange-100 text-orange-700",
  PWC_CONFIRMATION_AWAITED: "bg-amber-100 text-amber-700",
  GATEPASS_PENDING: "bg-teal-100 text-teal-700",
  ALIGN_FOR_PICKUP: "bg-cyan-100 text-cyan-700",
  IN_TRANSIT: "bg-sky-100 text-sky-700",
  ON_HOLD: "bg-zinc-100 text-zinc-700",
  RTO_CASE: "bg-rose-100 text-rose-700",
  LOST_DEVICE: "bg-stone-100 text-stone-700",
  RECEIVED_AT_WAREHOUSE: "bg-emerald-100 text-emerald-700",
  QC_CLEANED: "bg-lime-100 text-lime-700",
  QC_COMPLETED: "bg-violet-100 text-violet-700",
  DC_REQUESTED: "bg-indigo-100 text-indigo-700",
  DC_GENERATED: "bg-indigo-200 text-indigo-800",
  EWAY_BILL_REQUESTED: "bg-yellow-100 text-yellow-700",
  EWAY_BILL_GENERATED: "bg-orange-100 text-orange-700",
  BLANCO_CERTIFIED: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-200 text-green-800",
};

const PAGE_SIZE = 50;

export function ReverseTableModal({ open, onClose, title, icon, iconBg, statuses }: Props) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof getReversePickupsByStatus>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await getReversePickupsByStatus(statuses, p, PAGE_SIZE);
      setItems(data.items);
      setTotal(data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [statuses]);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchPage(1);
    }
  }, [open, fetchPage]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-xl border w-full max-w-5xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${iconBg}`}>
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading..." : `${total} request${total !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-auto p-6 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 text-muted-foreground animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No requests found.</p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-semibold">Request No.</th>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Serial No.</th>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">SLA</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{item.requestNumber}</td>
                    <td className="px-4 py-3 font-medium">{item.employeeName}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.serialNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.model}</td>
                    <td className="px-4 py-3">
                      {item.sla ? (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.sla.toLowerCase() === "met" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {item.sla}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPage(page - 1)}
                disabled={page <= 1 || loading}
                className="p-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="p-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
