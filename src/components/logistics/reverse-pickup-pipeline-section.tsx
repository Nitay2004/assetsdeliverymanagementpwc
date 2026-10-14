"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Truck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  assignPartner,
  requestDc,
  requestEwayBill,
  assignReversePickupDocket,
  getReversePickupDropdowns,
  addReversePickupDropdownOption,
  deleteReversePickupDropdownOption,
  seedReversePickupDropdowns,
} from "@/app/actions/reverse-pickup";
import { ManageableDropdown } from "@/components/inventory/manageable-dropdown";
import { ColumnFilterHeader, useColumnFilters, type ColumnFilterConfig } from "@/components/shared/column-filter";
import { UrlDataTableFilter } from "@/components/shared/data-table-filter";
import { STATUS_LABELS } from "@/lib/reverse-pickup-config";

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
  docketNumber: string | null;
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

// A request is in "pre-partner" until a pickup partner is aligned; these are the
// legacy entry statuses plus the ones the office can park a request at.
const PRE_PARTNER = new Set([
  "REQUESTED",
  "PENDING",
  "PWC_CONFIRMATION_AWAITED",
  "GATEPASS_PENDING",
  "ALIGN_FOR_PICKUP",
  "ON_HOLD",
]);

// Statuses where the docket number is the next value logistics supplies.
const DOCKET_READY = new Set(["DOCKET_REQUESTED", "EWAY_BILL_GENERATED"]);

// Only the columns that are worth narrowing by get a filter header; request
// numbers stay in the free-text search.
const FILTER_COLUMNS: ColumnFilterConfig<RpRequest>[] = [
  { key: "aserial", getValue: r => r.serialNumber },
  { key: "amodel", getValue: r => r.model },
  { key: "aemployee", getValue: r => r.employeeName },
  { key: "acity", getValue: r => r.city },
  { key: "astatus", getValue: r => r.status },
];

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-700",
  PENDING: "bg-amber-100 text-amber-700",
  PWC_CONFIRMATION_AWAITED: "bg-amber-100 text-amber-700",
  GATEPASS_PENDING: "bg-amber-100 text-amber-700",
  ALIGN_FOR_PICKUP: "bg-amber-100 text-amber-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  PARTNER_ASSIGNED: "bg-blue-100 text-blue-700",
  DC_REQUESTED: "bg-orange-100 text-orange-700",
  DC_GENERATED: "bg-indigo-100 text-indigo-700",
  EWAY_BILL_REQUESTED: "bg-yellow-100 text-yellow-700",
  EWAY_BILL_GENERATED: "bg-indigo-100 text-indigo-700",
  DOCKET_REQUESTED: "bg-orange-100 text-orange-700",
  DOCKET_ASSIGNED: "bg-green-100 text-green-700",
};

const ACTION_BUTTON =
  "inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors";

export function ReversePickupPipelineSection({ requests, canManage, totalPending, columnFilterValues }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [partnerInputs, setPartnerInputs] = useState<Record<string, string>>({});
  const [docketInputs, setDocketInputs] = useState<Record<string, string>>({});
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

  // Every step submits the same { id } form to one of the handover actions and
  // reports the same way, so the plumbing lives in one place. Returns whether it
  // succeeded so callers can decide whether to clear their input.
  async function run(
    id: string,
    action: (fd: FormData) => Promise<void>,
    success: { title: string; description: string },
    extra?: Record<string, string>,
  ): Promise<boolean> {
    setSaving(id);
    try {
      const fd = new FormData();
      fd.set("id", id);
      if (extra) {
        for (const [key, value] of Object.entries(extra)) fd.set(key, value);
      }
      await action(fd);
      toast({ title: success.title, description: success.description, variant: "success" });
      router.refresh();
      return true;
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function handleAssignPartner(requestId: string) {
    const partnerName = partnerInputs[requestId]?.trim();
    if (!partnerName) {
      toast({ title: "Error", description: "Partner name is required.", variant: "error" });
      return;
    }
    const ok = await run(
      requestId,
      assignPartner,
      { title: "Partner Assigned", description: "Request moved to Partner Assigned." },
      { partnerName },
    );
    if (ok) {
      setPartnerInputs(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    }
  }

  function handleRequestDc(requestId: string) {
    return run(requestId, requestDc, {
      title: "DC Requested",
      description: "Finance has been asked to generate the DC.",
    });
  }

  function handleRequestEway(requestId: string) {
    return run(requestId, requestEwayBill, {
      title: "E-Way Bill Requested",
      description: "Finance has been asked to generate the e-way bill.",
    });
  }

  async function handleAssignDocket(requestId: string) {
    const docketNumber = docketInputs[requestId]?.trim();
    if (!docketNumber) {
      toast({ title: "Error", description: "Docket number is required.", variant: "error" });
      return;
    }
    const ok = await run(
      requestId,
      assignReversePickupDocket,
      { title: "Docket Assigned", description: "Request advanced to inspection." },
      { docketNumber },
    );
    if (ok) {
      setDocketInputs(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    }
  }

  const columnCount = canManage ? 8 : 7;

  function renderAction(r: RpRequest) {
    if (PRE_PARTNER.has(r.status)) {
      return (
        <button onClick={() => handleAssignPartner(r.id)} disabled={saving === r.id} className={ACTION_BUTTON}>
          {saving === r.id && <Loader2 className="size-3 animate-spin" />}
          {saving === r.id ? "Assigning..." : "Assign Partner"}
        </button>
      );
    }
    if (r.status === "PARTNER_ASSIGNED") {
      return (
        <button onClick={() => handleRequestDc(r.id)} disabled={saving === r.id} className={ACTION_BUTTON}>
          {saving === r.id && <Loader2 className="size-3 animate-spin" />}
          {saving === r.id ? "Requesting..." : "Request DC"}
        </button>
      );
    }
    if (r.status === "DC_REQUESTED") {
      return <span className="text-xs text-muted-foreground italic">Awaiting Finance (DC)</span>;
    }
    if (r.status === "DC_GENERATED") {
      return (
        <button onClick={() => handleRequestEway(r.id)} disabled={saving === r.id} className={ACTION_BUTTON}>
          {saving === r.id && <Loader2 className="size-3 animate-spin" />}
          {saving === r.id ? "Requesting..." : "Request E-Way Bill"}
        </button>
      );
    }
    if (r.status === "EWAY_BILL_REQUESTED") {
      return <span className="text-xs text-muted-foreground italic">Awaiting Finance (E-Way)</span>;
    }
    if (DOCKET_READY.has(r.status)) {
      return (
        <div className="flex items-center gap-2">
          <input
            value={docketInputs[r.id] ?? ""}
            onChange={e => setDocketInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
            className="w-32 rounded border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Docket #"
          />
          <button onClick={() => handleAssignDocket(r.id)} disabled={saving === r.id} className={ACTION_BUTTON}>
            {saving === r.id && <Loader2 className="size-3 animate-spin" />}
            {saving === r.id ? "Saving..." : "Generate Docket"}
          </button>
        </div>
      );
    }
    if (r.status === "DOCKET_ASSIGNED") {
      return (
        <span className="text-xs text-muted-foreground">
          Docket assigned{r.docketNumber ? `: ${r.docketNumber}` : ""}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground italic">No action needed</span>;
  }

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-blue-50 flex items-center gap-2">
        <Truck className="size-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-blue-800">Reverse Pickup — Pipeline</h2>
        <span className="ml-auto text-xs text-blue-600 font-medium">{pendingCount} in pipeline</span>
      </div>

      <div className="px-6 py-3 border-b">
        <UrlDataTableFilter paramName="asearch" placeholder="Search request, serial, model, employee, city..." />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40">
            <tr>
              <th className="px-6 py-4 font-semibold">Request #</th>
              <ColumnFilterHeader label="Serial #" values={distinctValues.aserial ?? []} selected={filters.aserial ?? []} onApply={v => applyColumn("aserial", v)} />
              <ColumnFilterHeader label="Model" values={distinctValues.amodel ?? []} selected={filters.amodel ?? []} onApply={v => applyColumn("amodel", v)} />
              <ColumnFilterHeader label="Employee" values={distinctValues.aemployee ?? []} selected={filters.aemployee ?? []} onApply={v => applyColumn("aemployee", v)} />
              <ColumnFilterHeader label="Status" values={distinctValues.astatus ?? []} selected={filters.astatus ?? []} onApply={v => applyColumn("astatus", v)} />
              <ColumnFilterHeader label="Pickup Address" values={distinctValues.acity ?? []} selected={filters.acity ?? []} onApply={v => applyColumn("acity", v)} />
              <th className="px-6 py-4 font-semibold">Partner</th>
              {canManage && <th className="px-6 py-4 font-semibold">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  {activeFilterCount > 0 ? "No rows match the current filters." : "No reverse pickup requests pending."}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const prePartner = PRE_PARTNER.has(r.status);
                return (
                  <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600">
                      {r.requestNumber}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{r.serialNumber}</td>
                    <td className="px-6 py-4">{r.model}</td>
                    <td className="px-6 py-4">{r.employeeName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[r.status] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">
                      {r.pickupAddress}
                      {r.city ? `, ${r.city}` : ""}
                    </td>
                    <td className="px-6 py-4 min-w-[220px]">
                      {canManage && prePartner ? (
                        <ManageableDropdown
                          name={`partner-${r.id}`}
                          placeholder="Select partner..."
                          value={partnerInputs[r.id] ?? ""}
                          onChange={(v) => setPartnerInputs((prev) => ({ ...prev, [r.id]: v }))}
                          options={dd?.partnerName ?? []}
                          allOptions={dd?.allOptions ?? []}
                          category="partnerName"
                          onAdd={handleAdd}
                          onDelete={handleDelete}
                          required
                        />
                      ) : (
                        <span className={r.partnerName ? "text-foreground" : "text-muted-foreground italic"}>
                          {r.partnerName ?? "—"}
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4">{renderAction(r)}</td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
