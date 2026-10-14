"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { assignReversePickupDocket } from "@/app/actions/reverse-pickup";
import { ColumnFilterHeader, useColumnFilters, type ColumnFilterConfig } from "@/components/shared/column-filter";
import { UrlDataTableFilter } from "@/components/shared/data-table-filter";

interface RpRequest {
  id: string;
  requestNumber: string;
  serialNumber: string;
  model: string;
  employeeName: string;
  pickupAddress: string;
  city: string | null;
  state: string | null;
  status: string;
  docketNumber: string | null;
}

interface Props {
  requests: RpRequest[];
  canManage: boolean;
  /** Pending-to-assign across the whole queue; `requests` only holds one page. */
  totalPending?: number;
  columnFilterValues?: Record<string, { value: string; count: number }[]>;
}

const FILTER_COLUMNS: ColumnFilterConfig<RpRequest>[] = [
  { key: "dserial", getValue: r => r.serialNumber },
  { key: "dmodel", getValue: r => r.model },
  { key: "demployee", getValue: r => r.employeeName },
  { key: "dcity", getValue: r => r.city },
  { key: "dstatus", getValue: r => r.status },
];

export function ReversePickupDocketSection({ requests, canManage, totalPending, columnFilterValues }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [docketInputs, setDocketInputs] = useState<Record<string, string>>({});
  const pendingCount = totalPending ?? requests.filter(r => r.status === "DOCKET_REQUESTED").length;
  const { filteredRows: rows, distinctValues, filters, applyColumn, activeFilterCount } = useColumnFilters(
    FILTER_COLUMNS,
    requests,
    { distinctValues: columnFilterValues, pageParam: "rpage" },
  );

  async function handleAssign(requestId: string) {
    const docketNumber = docketInputs[requestId];
    if (!docketNumber?.trim()) {
      toast({ title: "Error", description: "Docket number is required.", variant: "error" });
      return;
    }
    setSaving(requestId);
    try {
      const fd = new FormData();
      fd.set("id", requestId);
      fd.set("docketNumber", docketNumber.trim());
      await assignReversePickupDocket(fd);
      toast({ title: "Docket Assigned", description: "Reverse pickup request advanced to inspection.", variant: "success" });
      setDocketInputs(prev => { const n = { ...prev }; delete n[requestId]; return n; });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setSaving(null); }
  }

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-orange-50 flex items-center gap-2">
        <ArrowUpRight className="size-4 text-orange-600" />
        <h2 className="text-sm font-semibold text-orange-800">Reverse Pickup — Docket Requests</h2>
        <span className="ml-auto text-xs text-orange-600 font-medium">{pendingCount} pending</span>
      </div>
      <div className="px-6 py-3 border-b">
        <UrlDataTableFilter paramName="dsearch" placeholder="Search request, serial, model, employee, docket..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40">
            <tr>
              <th className="px-6 py-4 font-semibold">Request #</th>
              <ColumnFilterHeader label="Serial #" values={distinctValues.dserial ?? []} selected={filters.dserial ?? []} onApply={v => applyColumn("dserial", v)} />
              <ColumnFilterHeader label="Model" values={distinctValues.dmodel ?? []} selected={filters.dmodel ?? []} onApply={v => applyColumn("dmodel", v)} />
              <ColumnFilterHeader label="Employee" values={distinctValues.demployee ?? []} selected={filters.demployee ?? []} onApply={v => applyColumn("demployee", v)} />
              <ColumnFilterHeader label="Status" values={distinctValues.dstatus ?? []} selected={filters.dstatus ?? []} onApply={v => applyColumn("dstatus", v)} />
              <ColumnFilterHeader label="Pickup Address" values={distinctValues.dcity ?? []} selected={filters.dcity ?? []} onApply={v => applyColumn("dcity", v)} />
              {canManage && <th className="px-6 py-4 font-semibold">Docket #</th>}
              {canManage && <th className="px-6 py-4 font-semibold">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={canManage ? 8 : 6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  {activeFilterCount > 0 ? "No rows match the current filters." : "No reverse pickup docket requests pending."}
                </td>
              </tr>
            )}
            {rows.map(r => {
              const assigned = r.status === "DOCKET_ASSIGNED";
              return (
              <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600">{r.requestNumber}</td>
                <td className="px-6 py-4 font-mono text-xs">{r.serialNumber}</td>
                <td className="px-6 py-4">{r.model}</td>
                <td className="px-6 py-4">{r.employeeName}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${assigned ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {assigned ? "Docket Assigned" : "Docket Requested"}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">
                  {r.pickupAddress}{r.city ? `, ${r.city}` : ""}
                </td>
                {canManage && (
                  <td className="px-6 py-4 font-mono text-xs">
                    {assigned ? (r.docketNumber || <span className="text-muted-foreground italic">—</span>) : (
                      <input
                        value={docketInputs[r.id] ?? ""}
                        onChange={e => setDocketInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                        className="w-36 rounded border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="Enter docket #"
                      />
                    )}
                  </td>
                )}
                {canManage && (
                  <td className="px-6 py-4">
                    {assigned ? (
                      <span className="text-xs text-muted-foreground">No action needed</span>
                    ) : (
                      <button
                        onClick={() => handleAssign(r.id)}
                        disabled={saving === r.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {saving === r.id ? <Loader2 className="size-3 animate-spin" /> : null}
                        {saving === r.id ? "Assigning..." : "Assign Docket"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}