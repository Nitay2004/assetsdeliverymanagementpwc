"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  assignPartner,
  getReversePickupDropdowns,
  addReversePickupDropdownOption,
  deleteReversePickupDropdownOption,
  seedReversePickupDropdowns,
} from "@/app/actions/reverse-pickup";
import { ManageableDropdown } from "@/components/inventory/manageable-dropdown";

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
  partnerName: string | null;
  partnerReference: string | null;
}

interface DropdownData {
  partnerName: string[];
  allOptions: { id: string; category: string; value: string }[];
}

interface Props {
  requests: RpRequest[];
  canManage: boolean;
  /** Full queue size; `requests` only holds the current page. */
  totalPending?: number;
}

export function ReversePickupPartnerAlignSection({ requests, canManage, totalPending }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [partnerInputs, setPartnerInputs] = useState<Record<string, string>>({});
  const [refInputs, setRefInputs] = useState<Record<string, string>>({});
  const [dd, setDd] = useState<DropdownData | null>(null);

  const pendingCount = totalPending ?? requests.length;

  const loadDd = useCallback(async () => {
    let data = await getReversePickupDropdowns();
    if (data.partnerName.length === 0) {
      await seedReversePickupDropdowns();
      data = await getReversePickupDropdowns();
    }
    setDd({
      partnerName: data.partnerName,
      allOptions: data.allOptions,
    });
  }, []);

  useEffect(() => {
    loadDd();
  }, [loadDd]);

  async function handleAdd(cat: string, val: string) {
    await addReversePickupDropdownOption(cat, val);
    await loadDd();
  }

  async function handleDelete(id: string) {
    await deleteReversePickupDropdownOption(id);
    await loadDd();
  }

  async function handleAssign(requestId: string) {
    const partnerName = partnerInputs[requestId]?.trim();
    if (!partnerName) {
      toast({
        title: "Error",
        description: "Partner name is required.",
        variant: "error",
      });
      return;
    }
    setSaving(requestId);
    try {
      const fd = new FormData();
      fd.set("id", requestId);
      fd.set("partnerName", partnerName);
      const ref = refInputs[requestId]?.trim();
      if (ref) fd.set("partnerReference", ref);
      await assignPartner(fd);
      toast({
        title: "Partner Assigned",
        description: "Reverse pickup request moved to Partner Assigned.",
        variant: "success",
      });
      setPartnerInputs((prev) => {
        const n = { ...prev };
        delete n[requestId];
        return n;
      });
      setRefInputs((prev) => {
        const n = { ...prev };
        delete n[requestId];
        return n;
      });
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || String(err),
        variant: "error",
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-blue-50 flex items-center gap-2">
        <UserPlus className="size-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-blue-800">
          Reverse Pickup — Align Partner
        </h2>
        <span className="ml-auto text-xs text-blue-600 font-medium">
          {pendingCount} pending
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40">
            <tr>
              <th className="px-6 py-4 font-semibold">Request #</th>
              <th className="px-6 py-4 font-semibold">Serial #</th>
              <th className="px-6 py-4 font-semibold">Model</th>
              <th className="px-6 py-4 font-semibold">Employee</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Pickup Address</th>
              {canManage && <th className="px-6 py-4 font-semibold">Partner Name</th>}
              {canManage && <th className="px-6 py-4 font-semibold">Partner Ref.</th>}
              {canManage && <th className="px-6 py-4 font-semibold">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 9 : 6}
                  className="px-6 py-8 text-center text-sm text-muted-foreground"
                >
                  No requests pending for partner alignment.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600">
                    {r.requestNumber}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{r.serialNumber}</td>
                  <td className="px-6 py-4">{r.model}</td>
                  <td className="px-6 py-4">{r.employeeName}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      Requested
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">
                    {r.pickupAddress}
                    {r.city ? `, ${r.city}` : ""}
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 min-w-[220px]">
                      <ManageableDropdown
                        name={`partner-${r.id}`}
                        placeholder="Select partner..."
                        value={partnerInputs[r.id] ?? ""}
                        onChange={(v) =>
                          setPartnerInputs((prev) => ({
                            ...prev,
                            [r.id]: v,
                          }))
                        }
                        options={dd?.partnerName ?? []}
                        allOptions={dd?.allOptions ?? []}
                        category="partnerName"
                        onAdd={handleAdd}
                        onDelete={handleDelete}
                        required
                      />
                    </td>
                  )}
                  {canManage && (
                    <td className="px-6 py-4">
                      <input
                        value={refInputs[r.id] ?? ""}
                        onChange={(e) =>
                          setRefInputs((prev) => ({
                            ...prev,
                            [r.id]: e.target.value,
                          }))
                        }
                        className="w-36 rounded border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="Ref. # (optional)"
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
                        {saving === r.id && <Loader2 className="size-3 animate-spin" />}
                        {saving === r.id ? "Assigning..." : "Assign Partner"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
