"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getInventoryBySlaStatus } from "@/app/actions/dashboard";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  slaValue: string;
}

const PAGE_SIZE = 50;

export function InventorySlaModal({ open, onClose, title, icon, iconBg, slaValue }: Props) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof getInventoryBySlaStatus>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await getInventoryBySlaStatus(slaValue, p, PAGE_SIZE);
      setItems(data.items);
      setTotal(data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [slaValue]);

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
                {loading ? "Loading..." : `${total} item${total !== 1 ? "s" : ""}`}
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
            <p className="text-sm text-muted-foreground text-center py-8">No items found.</p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-semibold">Serial No.</th>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">Assigned To</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{item.serialNumber}</td>
                    <td className="px-4 py-3">{item.model}</td>
                    <td className="px-4 py-3">{item.employeeName ?? <span className="text-xs text-muted-foreground italic">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.status === "ALLOCATED" ? "bg-blue-100 text-blue-700" : item.status === "AVAILABLE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.slaStatus ? (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.slaStatus.toLowerCase() === "met" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {item.slaStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
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
