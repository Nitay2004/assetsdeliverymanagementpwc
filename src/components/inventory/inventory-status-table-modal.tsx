"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getInventoryByStatus } from "@/app/actions/dashboard";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  status: string;
  icon: React.ReactNode;
  iconBg: string;
}

const PAGE_SIZE = 50;

export function InventoryStatusTableModal({ open, onClose, title, status, icon, iconBg }: Props) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof getInventoryByStatus>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await getInventoryByStatus(status, p, PAGE_SIZE);
      setItems(data.items);
      setTotal(data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors dashboard order-table-modal fetch-on-open pattern
      fetchPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-xl border w-full max-w-5xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading..." : `${total} laptop${total !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-auto min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 text-muted-foreground animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No {title.toLowerCase()} laptops found.</p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-semibold">Serial No.</th>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Assigned To</th>
                  <th className="px-4 py-3 font-semibold">Invoicing Warehouse</th>
                  <th className="px-4 py-3 font-semibold">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{item.serialNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.model}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.employeeName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.invoicingWarehouse || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
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
