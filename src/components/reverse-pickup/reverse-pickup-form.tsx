"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { createReversePickupRequest, getReversePickupDropdowns, addReversePickupDropdownOption, deleteReversePickupDropdownOption, seedReversePickupDropdowns } from "@/app/actions/reverse-pickup";
import { useToast } from "@/hooks/use-toast";
import { ManageableDropdown } from "@/components/inventory/manageable-dropdown";

type DropdownData = {
  types: string[]; entities: string[]; imageTypes: string[]; reasons: string[];
  warehouseLocations: string[]; displayStatuses: string[]; dependencies: string[];
  courierNames: string[]; blanccoYesNos: string[]; partnerNames: string[]; dispositions: string[];
  allOptions: { id: string; category: string; value: string }[];
};

function ManualInput({ name, label, type = "text", placeholder, required, colSpan }: {
  name: string; label: string; type?: string; placeholder?: string; required?: boolean; colSpan?: boolean;
}) {
  return (
    <div className={colSpan ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}>
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {type === "textarea" ? (
        <textarea id={name} name={name} rows={2}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          placeholder={placeholder}
        />
      ) : (
        <input id={name} name={name} type={type} required={required}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function DDField({ name, label, category, placeholder, required, dd, onAdd, onDelete }: {
  name: string; label: string; category: string; placeholder?: string; required?: boolean;
  dd: DropdownData | null; onAdd: (cat: string, val: string) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const opts = dd?.[category as keyof DropdownData] as string[] | undefined;
  const [val, setVal] = useState("");
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <ManageableDropdown
        name={name} placeholder={placeholder || `Select ${label.toLowerCase()}...`}
        value={val} onChange={setVal}
        options={opts ?? []} allOptions={dd?.allOptions ?? []}
        category={category} onAdd={onAdd} onDelete={onDelete} required={required}
      />
    </div>
  );
}

function AutoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex h-10 w-full items-center rounded-lg border border-input/50 bg-muted/20 px-3 text-sm text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

export function ReversePickupForm() {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [dd, setDd] = useState<DropdownData | null>(null);

  const loadDd = useCallback(async () => {
    let data = await getReversePickupDropdowns();
    if (data.types.length === 0 && data.entities.length === 0) {
      await seedReversePickupDropdowns();
      data = await getReversePickupDropdowns();
    }
    setDd(data);
  }, []);

  useEffect(() => { loadDd(); }, [loadDd]);

  async function handleAdd(cat: string, val: string) {
    await addReversePickupDropdownOption(cat, val);
    await loadDd();
  }
  async function handleDelete(id: string) {
    await deleteReversePickupDropdownOption(id);
    await loadDd();
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      await createReversePickupRequest(formData);
    } catch (err) {
      toast({ title: "Failed to create request", description: String(err), variant: "error" });
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Request Info ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Request Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AutoField label="Year" value={String(new Date().getFullYear())} />
          <input type="hidden" name="year" value={new Date().getFullYear()} />
          <DDField name="type" label="Type" category="types" placeholder="Select type..." dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
          <ManualInput name="srNo" label="Sr #" placeholder="Serial number" />
          <ManualInput name="requestDateHp" label="Request Date (HP)" type="date" />
          <ManualInput name="employeeId" label="Employee ID" placeholder="EMP-001" />
          <ManualInput name="alternateId" label="Alternate ID" placeholder="Alt ID" />
          <ManualInput name="lastWorkingDay" label="Last Working Day" type="date" />
        </div>
      </div>

      {/* ── User Details ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">User Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ManualInput name="employeeName" label="Name of User" required colSpan />
          <ManualInput name="emailId" label="Email ID" type="email" placeholder="john@example.com" />
          <ManualInput name="mobileNumber" label="User Contact Details" placeholder="+91 9876543210" />
          <ManualInput name="contact" label="Contact" placeholder="Alternate contact" />
        </div>
      </div>

      {/* ── Asset Details ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Asset Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ManualInput name="model" label="Laptop Model" required placeholder="e.g. HP EliteBook" />
          <ManualInput name="serialNumber" label="Serial Number" required placeholder="SN-12345" />
          <DDField name="entity" label="Entity" category="entities" dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
          <DDField name="imageType" label="Image Type" category="imageTypes" dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
          <ManualInput name="accessories" label="Accessories" placeholder="Charger, mouse, etc." colSpan />
          <DDField name="reason" label="Reason" category="reasons" dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
        </div>
      </div>

      {/* ── Pickup Location ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Pickup Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ManualInput name="pickupAddress" label="Location Address" required colSpan type="textarea" placeholder="123, Main Street, ..." />
          <ManualInput name="landmark" label="Land Mark" placeholder="Near ..." />
          <ManualInput name="city" label="City" placeholder="Mumbai" />
          <ManualInput name="state" label="State" placeholder="Maharashtra" />
          <ManualInput name="pinCode" label="Pin Code" placeholder="400001" />
        </div>
      </div>

      {/* ── Warehouse / Logistics ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Warehouse &amp; Logistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DDField name="warehouseLocation" label="Warehouse" category="warehouseLocations" dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
          <ManualInput name="receiverSerialNo" label="Receiver Serial No" placeholder="Receiver SN" />
          <AutoField label="Receiver S NO Entity" value="(auto)" />
          <DDField name="displayStatus" label="Status" category="displayStatuses" placeholder="Select status..." dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
          <ManualInput name="eta" label="ETA" type="date" />
          <ManualInput name="futureDatePickup" label="Future Date Pickup" type="date" />
          <DDField name="dependency" label="Dependency" category="dependencies" dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
          <ManualInput name="remarks" label="Remarks" colSpan type="textarea" placeholder="General remarks..." />
        </div>
      </div>

      {/* ── SLA / TAT ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">SLA &amp; TAT</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ManualInput name="emailReceivedHour" label="Email Received Hour" placeholder="10:00 AM" />
          <AutoField label="Cut Off Status" value="(auto)" />
          <AutoField label="SLA Start Date" value="(auto)" />
          <AutoField label="State (SLA)" value="(auto)" />
          <AutoField label="Zone (1)" value="(auto)" />
          <AutoField label="Tier 1" value="(auto)" />
          <AutoField label="ODA Location" value="(auto)" />
          <AutoField label="TAT" value="(auto)" />
          <AutoField label="Delivery TAT" value="(auto)" />
          <ManualInput name="actualDeliveryPodDate" label="Actual Delivery/POD Date" type="date" />
          <AutoField label="SLA" value="(auto)" />
          <AutoField label="Laptop Acceptance Date" value="(auto)" />
        </div>
      </div>

      {/* ── Courier / Tracking ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Courier &amp; Tracking</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DDField name="courierName" label="Courier Name" category="courierNames" dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
          <ManualInput name="docketNumber" label="Docket No" placeholder="Docket / AWB" />
          <ManualInput name="pickupDate" label="Pickup Date" type="date" />
          <AutoField label="DC No" value="(auto)" />
          <ManualInput name="srnNo" label="SRN No" placeholder="SRN number" />
          <AutoField label="E Way Bill No" value="(auto)" />
          <ManualInput name="etaForUnitReceived" label="ETA for Unit to be Received" type="date" />
          <AutoField label="Case Age" value="(auto)" />
        </div>
      </div>

      {/* ── Blancco ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Blancco</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DDField name="blanccoYesNo" label="Blancco Yes/No" category="blanccoYesNos" dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
          <ManualInput name="blanccoDate" label="Blancco Date" type="date" />
        </div>
      </div>

      {/* ── Case Info ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Case Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ManualInput name="caseId" label="Case ID" placeholder="CASE-001" />
          <ManualInput name="issueReported" label="Issue Reported" placeholder="Describe the issue" colSpan type="textarea" />
          <ManualInput name="replacementPart" label="Replacement Part" placeholder="Part name / number" colSpan />
          <ManualInput name="exceptionRemarks" label="Exception Remarks" colSpan type="textarea" placeholder="Exception details..." />
          <ManualInput name="remark" label="Remark" colSpan type="textarea" placeholder="Additional remark..." />
        </div>
      </div>

      {/* ── Submit ── */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard/reverse-pickup"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to List
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-press"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Creating..." : "Create Request"}
        </button>
      </div>
    </form>
  );
}
