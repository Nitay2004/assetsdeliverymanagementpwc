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
  columnFilterValues?: Record<string, { value: string; count: number }[]>;
}

// Only the columns that are worth narrowing by get a filter header; request and
// serial numbers stay in the free-text search.
const FILTER_COLUMNS: ColumnFilterConfig<RpRequest>[] = [
  { key: "amodel", getValue: r => r.model },
  { key: "aemployee", getValue: r => r.employeeName },
  { key: "acity", getValue: r => r.city },
];

export function ReversePickupPartnerAlignSection({ requests, canManage, totalPending, columnFilterValues }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [partnerInputs, setPartnerInputs] = useState<Record<string, string>>({});
  const [dd, setDd] = useState<DropdownData | null>(null);

  const pendingCount = totalPending ?? requests.length;
  const { filteredRows: rows, distinctValues, filters, applyColumn, activeFilterCount } = useColumnFilters(
    FILTER_COLUMNS,
    requests,
    { distinctValues: columnFilterValues, pageParam: "rpage" },
  );

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

      <div className="px-6 py-3 border-b">
        <UrlDataTableFilter paramName="asearch" placeholder="Search request, serial, model, employee, city..." />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40">
            <tr>
              <th className="px-6 py-4 font-semibold">Request #</th>
              <th className="px-6 py-4 font-semibold">Serial #</th>
              <ColumnFilterHeader label="Model" values={distinctValues.amodel ?? []} selected={filters.amodel ?? []} onApply={v => applyColumn("amodel", v)} />
              <ColumnFilterHeader label="Employee" values={distinctValues.aemployee ?? []} selected={filters.aemployee ?? []} onApply={v => applyColumn("aemployee", v)} />
              <th className="px-6 py-4 font-semibold">Status</th>
              <ColumnFilterHeader label="Pickup Address" values={distinctValues.acity ?? []} selected={filters.acity ?? []} onApply={v => applyColumn("acity", v)} />
              {canManage && <th className="px-6 py-4 font-semibold">Partner Name</th>}
              {canManage && <th className="px-6 py-4 font-semibold">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 8 : 6}
                  className="px-6 py-8 text-center text-sm text-muted-foreground"
                >
                  {activeFilterCount > 0 ? "No rows match the current filters." : "No requests pending for partner alignment."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
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
