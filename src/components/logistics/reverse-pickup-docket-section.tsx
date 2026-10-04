"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { assignReversePickupDocket } from "@/app/actions/reverse-pickup";

interface RpRequest {
  id: string;
  requestNumber: string;
  serialNumber: string;
  model: string;
  employeeName: string;
  pickupAddress: string;
  city: string | null;
  state: string | null;
}

interface Props {
  requests: RpRequest[];
  canManage: boolean;
}

export function ReversePickupDocketSection({ requests, canManage }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [docketInputs, setDocketInputs] = useState<Record<string, string>>({});

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
        <span className="ml-auto text-xs text-orange-600 font-medium">{requests.length} pending</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40">
            <tr>
              <th className="px-6 py-4 font-semibold">Request #</th>
              <th className="px-6 py-4 font-semibold">Serial #</th>
              <th className="px-6 py-4 font-semibold">Model</th>
              <th className="px-6 py-4 font-semibold">Employee</th>
              <th className="px-6 py-4 font-semibold">Pickup Address</th>
              {canManage && <th className="px-6 py-4 font-semibold">Docket #</th>}
              {canManage && <th className="px-6 py-4 font-semibold">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.map(r => (
              <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600">{r.requestNumber}</td>
                <td className="px-6 py-4 font-mono text-xs">{r.serialNumber}</td>
                <td className="px-6 py-4">{r.model}</td>
                <td className="px-6 py-4">{r.employeeName}</td>
                <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">
                  {r.pickupAddress}{r.city ? `, ${r.city}` : ""}
                </td>
                {canManage && (
                  <td className="px-6 py-4">
                    <input
                      value={docketInputs[r.id] ?? ""}
                      onChange={e => setDocketInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                      className="w-36 rounded border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Enter docket #"
                    />
                  </td>
                )}
                {canManage && (
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleAssign(r.id)}
                      disabled={saving === r.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {saving === r.id ? <Loader2 className="size-3 animate-spin" /> : null}
                      {saving === r.id ? "Assigning..." : "Assign Docket"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}