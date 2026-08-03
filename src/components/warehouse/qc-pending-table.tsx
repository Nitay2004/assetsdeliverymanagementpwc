"use client";

import { useState } from "react";
import { ClipboardCheck, ArrowRight, CheckCheck } from "lucide-react";
import { AssignQcEngineerModal } from "@/components/warehouse/assign-qc-engineer-modal";
import { QcPanel, QcResultBadge, type QcItem } from "@/components/qc/qc-panel";

export { type QcItem } from "@/components/qc/qc-panel";

export function QcPendingTable({
  items,
  canManage,
  showQcPanel = false,
}: {
  items: QcItem[];
  canManage: boolean;
  showQcPanel?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const active = items.find(i => i.id === activeId) ?? null;

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-amber-50/50 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-100">
          <ClipboardCheck className="size-5 text-amber-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">QC Assignments — Assets Sent for QC</h2>
          <p className="text-xs text-muted-foreground">
            {items.length} asset(s). Assign an engineer to start QC; handed-over assets are marked below.
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
              <th className="px-4 py-3 font-semibold">QC Engineer</th>
              <th className="px-4 py-3 font-semibold">Clean QC</th>
              <th className="px-4 py-3 font-semibold">Purge QC</th>
              {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
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
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.qcEngineer || "—"}</td>
                  <td className="px-4 py-3"><QcResultBadge result={item.qcCleanResult} /></td>
                  <td className="px-4 py-3"><QcResultBadge result={item.qcPurgeResult} /></td>
                  {canManage && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {handedOver ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                          <CheckCheck className="size-3.5" />
                          Handed Over
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setAssignId(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
                          >
                            <ArrowRight className="size-3.5" />
                            {item.qcEngineer ? "Reassign for QC" : "Move to QC"}
                          </button>
                          {showQcPanel && (
                            <button
                              onClick={() => setActiveId(item.id)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 text-amber-700 px-2.5 py-1 text-xs font-semibold hover:bg-amber-50 transition-colors"
                            >
                              <ClipboardCheck className="size-3.5" />
                              Open QC
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {assignId && <AssignQcEngineerModal itemId={assignId} open onClose={() => setAssignId(null)} />}
      {active && showQcPanel && <QcPanel item={active} onClose={() => setActiveId(null)} />}
    </div>
  );
}
