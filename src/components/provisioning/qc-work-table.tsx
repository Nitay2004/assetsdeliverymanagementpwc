"use client";

import { useState } from "react";
import { ClipboardCheck, CheckCheck, UserCog } from "lucide-react";
import { QcPanel, QcResultBadge, type QcItem } from "@/components/qc/qc-panel";

export function QcWorkTable({ items }: { items: QcItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find(i => i.id === activeId) ?? null;

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-purple-50/50 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-100">
          <UserCog className="size-5 text-purple-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">My QC Tasks — Assets Assigned to Me</h2>
          <p className="text-xs text-muted-foreground">
            {items.length} asset(s) assigned for QC. Perform Clean &amp; Purge, then hand back to warehouse.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-4 py-3 font-semibold">Serial Number</th>
              <th className="px-4 py-3 font-semibold">Model</th>
              <th className="px-4 py-3 font-semibold">Employee Name</th>
              <th className="px-4 py-3 font-semibold">Warehouse</th>
              <th className="px-4 py-3 font-semibold">Clean QC</th>
              <th className="px-4 py-3 font-semibold">Purge QC</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(item => {
              const handedOver = !!item.qcCompletedAt;
              return (
                <tr
                  key={item.id}
                  className={handedOver ? "bg-green-50/40 transition-colors" : "hover:bg-muted/10 transition-colors"}
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{item.serialNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.model}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.employeeName || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.invoicingWarehouse || "—"}</td>
                  <td className="px-4 py-3"><QcResultBadge result={item.qcCleanResult} /></td>
                  <td className="px-4 py-3"><QcResultBadge result={item.qcPurgeResult} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {handedOver ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                        <CheckCheck className="size-3.5" />
                        Handed Over
                      </span>
                    ) : (
                      <button
                        onClick={() => setActiveId(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
                      >
                        <ClipboardCheck className="size-3.5" />
                        Start / Open QC
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {active && <QcPanel item={active} onClose={() => setActiveId(null)} />}
    </div>
  );
}
