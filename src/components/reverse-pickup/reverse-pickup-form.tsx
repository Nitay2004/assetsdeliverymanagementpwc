"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { createReversePickupRequest, getReversePickupDropdowns, addReversePickupDropdownOption, deleteReversePickupDropdownOption, seedReversePickupDropdowns, lookupInventoryBySerial } from "@/app/actions/reverse-pickup";
import { useToast } from "@/hooks/use-toast";
import { ManageableDropdown } from "@/components/inventory/manageable-dropdown";

type DropdownData = {
  type: string[]; entity: string[]; imageType: string[]; reason: string[];
  warehouseLocation: string[]; displayStatus: string[]; dependency: string[];
  courierName: string[]; blanccoYesNo: string[]; partnerName: string[]; disposition: string[];
  allOptions: { id: string; category: string; value: string }[];
};

function ManualInput({ name, label, type = "text", placeholder, required, colSpan, value, onChange }: {
  name: string; label: string; type?: string; placeholder?: string; required?: boolean; colSpan?: boolean;
  value?: string; onChange?: (val: string) => void;
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
          value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
      ) : (
        <input id={name} name={name} type={type} required={required}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder={placeholder}
          value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
      )}
    </div>
  );
}

function DDField({ name, label, category, placeholder, required, dd, onAdd, onDelete, value, onChange }: {
  name: string; label: string; category: string; placeholder?: string; required?: boolean;
  dd: DropdownData | null; onAdd: (cat: string, val: string) => Promise<void>; onDelete: (id: string) => Promise<void>;
  value?: string; onChange?: (val: string) => void;
}) {
  const opts = dd?.[category as keyof DropdownData] as string[] | undefined;
  const [internalVal, setInternalVal] = useState("");
  const val = value ?? internalVal;
  const setVal = onChange ?? setInternalVal;
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

export function ReversePickupForm({ initialData }: { initialData?: Record<string, string> }) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [dd, setDd] = useState<DropdownData | null>(null);
  const [serialNumber, setSerialNumber] = useState(initialData?.serialNumber || "");
  const [model, setModel] = useState(initialData?.model || "");
  const [entity, setEntity] = useState(initialData?.entity || "");
  const [imageType, setImageType] = useState(initialData?.imageType || "");
  const [employeeName, setEmployeeName] = useState(initialData?.employeeName || "");
  const [emailId, setEmailId] = useState(initialData?.emailId || "");
  const [mobileNumber, setMobileNumber] = useState(initialData?.mobileNumber || "");
  const [pickupAddress, setPickupAddress] = useState(initialData?.shippingAddress || "");
  const [landmark, setLandmark] = useState(initialData?.landMark || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [state, setState] = useState(initialData?.state || "");
  const [pinCode, setPinCode] = useState(initialData?.pinCode || "");
  const [accessories, setAccessories] = useState("");
  const [lookupPending, setLookupPending] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);

  const loadDd = useCallback(async () => {
    let data = await getReversePickupDropdowns();
    if (data.type.length === 0 && data.entity.length === 0) {
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

  useEffect(() => {
    if (!serialNumber || serialNumber.trim().length === 0) return;
    const timer = setTimeout(async () => {
      setLookupPending(true);
      try {
        const result = await lookupInventoryBySerial(serialNumber.trim());
        if (result) {
          setModel(result.model || "");
          setEntity(result.entity || "");
          setImageType(result.imageType || "");
          setEmployeeName(result.employeeName || "");
          setEmailId(result.emailId || "");
          setMobileNumber(result.mobileNumber || "");
          setPickupAddress(result.shippingAddress || "");
          setLandmark(result.landMark || "");
          setCity(result.city || "");
          setState(result.state || "");
          setPinCode(result.pinCode || "");
          function hasAccessory(val: string | null | undefined): boolean {
            if (!val) return false;
            return !["—", "-", "--", "no", "n/a", "none", "nil", "na", "—"].includes(val.trim().toLowerCase());
          }
          const parts: string[] = [];
          if (hasAccessory(result.adaptorAdded)) parts.push("Adapter");
          if (hasAccessory(result.accessoryHeadsetMouse)) parts.push("Headset");
          setAccessories(parts.join(", "));
        }
      } catch {
        // ignore lookup errors
      } finally {
        setLookupPending(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [serialNumber]);

  // Pincode auto-fetch city/state
  useEffect(() => {
    const digits = pinCode.replace(/\D/g, "");
    if (digits.length !== 6) return;
    const timer = setTimeout(async () => {
      setPincodeLoading(true);
      try {
        const res = await fetch(`/api/pincode/${digits}`);
        if (res.ok) {
          const data = await res.json();
          if (data.city) setCity(data.city);
          if (data.state) setState(data.state);
        }
      } catch {
        // silent
      } finally {
        setPincodeLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [pinCode]);

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
          <DDField name="type" label="Type" category="type" placeholder="Select type..." dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
          <ManualInput name="srNo" label="Hp Sr No" placeholder="HP serial number" />
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
          <ManualInput name="employeeName" label="Name of User" required colSpan value={employeeName} onChange={setEmployeeName} />
          <ManualInput name="emailId" label="Email ID" type="email" placeholder="john@example.com" value={emailId} onChange={setEmailId} />
          <ManualInput name="mobileNumber" label="User Contact Details" placeholder="+91 9876543210" value={mobileNumber} onChange={setMobileNumber} />
          <ManualInput name="contact" label="Contact" placeholder="Alternate contact" />
        </div>
      </div>

      {/* ── Asset Details ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Asset Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ManualInput name="model" label="Laptop Model" required placeholder="e.g. HP EliteBook" value={model} onChange={setModel} />
          <ManualInput name="serialNumber" label="Serial Number" required placeholder="SN-12345" value={serialNumber} onChange={setSerialNumber} />
          <DDField name="entity" label="Entity" category="entity" dd={dd} onAdd={handleAdd} onDelete={handleDelete} value={entity} onChange={setEntity} />
          <DDField name="imageType" label="Image Type" category="imageType" dd={dd} onAdd={handleAdd} onDelete={handleDelete} value={imageType} onChange={setImageType} />
          <ManualInput name="accessories" label="Accessories" placeholder="Charger, mouse, etc." colSpan value={accessories} onChange={setAccessories} />
          <DDField name="reason" label="Reason" category="reason" dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
        </div>
      </div>

      {/* ── Pickup Location ── */}
      <div className="rounded-xl glass shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Pickup Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ManualInput name="pickupAddress" label="Location Address" required colSpan type="textarea" placeholder="123, Main Street, ..." value={pickupAddress} onChange={setPickupAddress} />
          <ManualInput name="landmark" label="Land Mark" placeholder="Near ..." value={landmark} onChange={setLandmark} />
          <ManualInput name="city" label="City" value={city} onChange={setCity} placeholder="Mumbai" />
          <ManualInput name="state" label="State" value={state} onChange={setState} placeholder="Maharashtra" />
          <div className="space-y-1.5">
            <label htmlFor="pinCode" className="text-sm font-medium text-foreground">Pin Code</label>
            <div className="relative">
              <input id="pinCode" name="pinCode" type="text" inputMode="numeric" maxLength={6}
                value={pinCode}
                onChange={e => setPinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="400001"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {pincodeLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">...</span>
              )}
            </div>
          </div>
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
