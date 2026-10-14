"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2, Plus, Trash2, Users, Upload } from "lucide-react";
import Link from "next/link";
import { createReversePickupRequest, getReversePickupDropdowns, addReversePickupDropdownOption, deleteReversePickupDropdownOption, seedReversePickupDropdowns, lookupInventoryBySerial, checkReversePickupEligibility } from "@/app/actions/reverse-pickup";
import { calculateCutoff } from "@/lib/cutoff-utils";
import {
  calculateExpectedDeliveryDate,
  calculateTatDays,
  calculateTier,
  calculateZone,
} from "@/lib/location-utils";
import { calculateSlaStatus } from "@/lib/sla-utils";
import { useToast } from "@/hooks/use-toast";
import { ManageableDropdown } from "@/components/inventory/manageable-dropdown";

type OfficeUser = {
  userName: string; employeeId: string; emailId: string; mobileNumber: string; contact: string;
  lastWorkingDay: string; serialNumber: string; model: string;
  entity: string; imageType: string; accessories: string; reason: string;
};

const OFFICE_FIELDS: (keyof OfficeUser)[] = [
  "userName", "employeeId", "emailId", "mobileNumber", "contact", "lastWorkingDay",
  "serialNumber", "model", "entity", "imageType", "accessories", "reason",
];

function emptyOfficeUser(): OfficeUser {
  return {
    userName: "", employeeId: "", emailId: "", mobileNumber: "", contact: "", lastWorkingDay: "",
    serialNumber: "", model: "", entity: "", imageType: "", accessories: "", reason: "",
  };
}

type DropdownData = {
  type: string[]; entity: string[]; imageType: string[]; reason: string[];
  warehouseLocation: string[]; displayStatus: string[]; dependency: string[];
  courierName: string[]; blanccoYesNo: string[]; partnerName: string[]; disposition: string[];
  allOptions: { id: string; category: string; value: string }[];
};

function ManualInput({ name, label, type = "text", placeholder, required, colSpan, value, onChange, hint }: {
  name: string; label: string; type?: string; placeholder?: string; required?: boolean; colSpan?: boolean;
  value?: string; onChange?: (val: string) => void; hint?: React.ReactNode;
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
      {hint}
    </div>
  );
}

// Shown under a serial number field once the live eligibility check has run:
// green when a request could be created, red with the exact reason when it
// could not (open request, not in inventory, not deployed, no delivery record).
function SerialCheckHint({ check }: { check?: { ok: boolean; message: string } }) {
  if (!check) return null;
  if (check.ok) {
    return (
      <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5 shrink-0" /> Eligible for reverse pickup
      </p>
    );
  }
  return (
    <p className="flex items-start gap-1 text-xs font-medium text-red-500">
      <AlertCircle className="mt-px size-3.5 shrink-0" /> <span>{check.message}</span>
    </p>
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

function AutoField({ label, name, value, type = "text" }: { label: string; name?: string; value: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        readOnly
        value={value}
        className="flex h-10 w-full cursor-default rounded-lg border border-input/50 bg-muted/20 px-3 text-sm text-muted-foreground"
      />
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
  const [emailReceivedHour, setEmailReceivedHour] = useState("");
  const [odaLocation, setOdaLocation] = useState("No");
  const [pickupDate, setPickupDate] = useState("");
  const [type, setType] = useState(initialData?.type || "");
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([emptyOfficeUser()]);
  // Live eligibility per serial, keyed by the serial string so a result for an
  // old value never shows under a newly typed one.
  const [serialChecks, setSerialChecks] = useState<Record<string, { ok: boolean; message: string }>>({});

  // Office pickups bundle several users on one request. Every per-asset field of
  // each user is saved on this single request as its own comma-separated list,
  // so nothing needs a new request per laptop.
  const isOffice = type.trim().toLowerCase() === "office";
  const joinOffice = (field: keyof OfficeUser) =>
    officeUsers.map(u => u[field].trim()).filter(Boolean).join(", ");
  const officeNames = joinOffice("userName");
  const officeSerials = joinOffice("serialNumber");
  const officeModels = joinOffice("model");
  const officeEntities = joinOffice("entity");
  const officeImageTypes = joinOffice("imageType");
  const officeAccessories = joinOffice("accessories");
  const officeReasons = joinOffice("reason");
  const officeEmails = joinOffice("emailId");
  const officeMobiles = joinOffice("mobileNumber");
  const officeContacts = joinOffice("contact");
  const officeEmployeeIds = joinOffice("employeeId");
  // officeLastWorkingDays removed (not in schema)

  // Current serials the live check has marked ineligible. Used to disable the
  // submit button and to keep the inline reason visible until it is fixed.
  const blockedSerials = (isOffice
    ? officeUsers.map((u) => u.serialNumber.trim())
    : [serialNumber.trim()]
  ).filter((s) => serialChecks[s] && !serialChecks[s].ok);

  // Frozen for the life of the form so the mirrored SLA start cannot drift as
  // days pass while the operator is filling the form in.
  const [raisedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Derived during render rather than stored in state: these are pure functions
  // of the inputs above, so there is nothing to keep in sync. This mirrors
  // resolveReversePickupSla on the server, including the fallback that anchors the
  // TAT clock on the raised date when the email hour yields no cutoff, so what is
  // shown here is exactly what gets saved.
  const cutoff = emailReceivedHour ? calculateCutoff(emailReceivedHour) : null;
  const cutOffStatus = cutoff?.cutOffStatus ?? "";
  const slaStartDate = cutoff?.slaStartDate ?? raisedDate;
  const zone1 = calculateZone(city, state) ?? "";
  const tier1 = calculateTier(city, state) ?? "";
  const tatDays = calculateTatDays(city, state, odaLocation);
  const tat = String(tatDays ?? 4);
  const expectedPickupDate = calculateExpectedDeliveryDate(slaStartDate, tatDays ?? 4) ?? "";
  const sla = calculateSlaStatus(pickupDate || null, expectedPickupDate || null);

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

  function updateOfficeUser(index: number, field: keyof OfficeUser, value: string) {
    setOfficeUsers(prev => prev.map((u, i) => (i === index ? { ...u, [field]: value } : u)));
  }
  function addOfficeUser() {
    setOfficeUsers(prev => [...prev, emptyOfficeUser()]);
  }
  function removeOfficeUser(index: number) {
    setOfficeUsers(prev => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  // Fills the office table from a spreadsheet. Columns are matched by header
  // name (Name, Serial Number, Model, Entity, Image Type, Accessories, Reason);
  // a sheet with no header is read positionally in that same order. Parsed rows
  // are appended to whatever is already in the table.
  async function handleOfficeExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("No sheet found in the file.");
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false }) as unknown[][];
      if (rows.length === 0) throw new Error("The sheet is empty.");

      const headers = (rows[0] ?? []).map(c => String(c ?? "").toLowerCase().trim());
      const findCol = (re: RegExp) => headers.findIndex(h => re.test(h));
      const idx: Record<keyof OfficeUser, number> = {
        userName: findCol(/user ?name|employee ?name|^name$/),
        serialNumber: findCol(/serial/),
        model: findCol(/model/),
        entity: findCol(/entity/),
        imageType: findCol(/image ?type/),
        accessories: findCol(/accessor/),
        reason: findCol(/reason/),
        emailId: findCol(/e-?mail/),
        mobileNumber: findCol(/mobile|contact ?(number|no)|phone/),
        contact: findCol(/alternate ?contact|alt ?contact/),
        employeeId: findCol(/employee ?id|emp ?id/),
        lastWorkingDay: findCol(/last ?working|last ?day|lwd/),
      };
      const hasHeader = OFFICE_FIELDS.some(f => idx[f] >= 0);
      const dataRows = hasHeader ? rows.slice(1) : rows;

      const parsed: OfficeUser[] = [];
      for (const row of dataRows) {
        const valueAt = (field: keyof OfficeUser) => {
          const col = hasHeader ? idx[field] : OFFICE_FIELDS.indexOf(field);
          return col >= 0 ? String(row[col] ?? "").trim() : "";
        };
        const user: OfficeUser = {
          userName: valueAt("userName"),
          employeeId: valueAt("employeeId"),
          emailId: valueAt("emailId"),
          mobileNumber: valueAt("mobileNumber"),
          contact: valueAt("contact"),
          lastWorkingDay: valueAt("lastWorkingDay"),
          serialNumber: valueAt("serialNumber"),
          model: valueAt("model"),
          entity: valueAt("entity"),
          imageType: valueAt("imageType"),
          accessories: valueAt("accessories"),
          reason: valueAt("reason"),
        };
        if (user.userName || user.serialNumber || user.model) parsed.push(user);
      }

      if (parsed.length === 0) {
        throw new Error("No user rows found. Add columns such as Name, Serial Number and Model.");
      }

      setOfficeUsers(prev => [...prev.filter(u => OFFICE_FIELDS.some(f => u[f].trim())), ...parsed]);
      toast({ title: "Imported", description: `${parsed.length} user row(s) added from ${file.name}.`, variant: "success" });
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : String(err), variant: "error" });
    }
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

  // Live eligibility: as soon as a serial is entered, show whether a request
  // could actually be created for it and why not. Every current serial is
  // checked in one round trip; the debounce keeps typing from firing a query
  // per keystroke and the minimum length avoids flagging half-typed serials.
  useEffect(() => {
    const serials = (isOffice
      ? officeUsers.map((u) => u.serialNumber.trim())
      : [serialNumber.trim()]
    ).filter((s) => s.length >= 4);

    // Nothing to check: results are keyed by serial, so entries for serials
    // that are no longer on the form simply stop matching and never show.
    if (serials.length === 0) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await checkReversePickupEligibility(serials);
        if (!cancelled) setSerialChecks(result);
      } catch {
        // Ignore check errors — the server still validates on submit.
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOffice, serialNumber, officeUsers]);

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
    if (isOffice) {
      const rows = officeUsers.filter(u => u.userName.trim() || u.serialNumber.trim() || u.model.trim());
      const invalid =
        rows.length === 0 ||
        rows.some(u => !u.userName.trim() || !u.serialNumber.trim() || !u.model.trim());
      if (invalid) {
        toast({
          title: "Incomplete office users",
          description: "Add at least one user, and fill in the name, serial number and model for every row.",
          variant: "error",
        });
        return;
      }
    }
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
          <DDField name="type" label="Type" category="type" placeholder="Select type..." dd={dd} onAdd={handleAdd} onDelete={handleDelete} value={type} onChange={setType} />
          <ManualInput name="srNo" label="Hp Sr No" placeholder="HP serial number" />
          <ManualInput name="requestDateHp" label="Request Date (HP)" type="date" />
          {!isOffice && <ManualInput name="employeeId" label="Employee ID" placeholder="EMP-001" />}
          <ManualInput name="alternateId" label="Alternate ID" placeholder="Alt ID" />
          {!isOffice && <ManualInput name="lastWorkingDay" label="Last Working Day" type="date" />}
        </div>
      </div>

      {/* ── User Details ── */}
      {!isOffice && (
        <div className="rounded-xl glass shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">User Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ManualInput name="employeeName" label="Name of User" required colSpan value={employeeName} onChange={setEmployeeName} />
            <ManualInput name="emailId" label="Email ID" type="text" placeholder="Email ID" value={emailId} onChange={setEmailId} />
            <ManualInput name="mobileNumber" label="User Contact Details" placeholder="+91 9876543210" value={mobileNumber} onChange={setMobileNumber} />
            <ManualInput name="contact" label="Contact" placeholder="Alternate contact" />
          </div>
        </div>
      )}

      {/* ── Office Users (multiple users per request) ── */}
      {isOffice && (
        <div className="rounded-xl glass shadow-sm p-6 space-y-4">
          <input type="hidden" name="employeeName" value={officeNames} />
          <input type="hidden" name="employeeId" value={officeEmployeeIds} />
          <input type="hidden" name="emailId" value={officeEmails} />
          <input type="hidden" name="mobileNumber" value={officeMobiles} />
          <input type="hidden" name="contact" value={officeContacts} />
          <input type="hidden" name="serialNumber" value={officeSerials} />
          <input type="hidden" name="model" value={officeModels} />
          <input type="hidden" name="entity" value={officeEntities} />
          <input type="hidden" name="imageType" value={officeImageTypes} />
          <input type="hidden" name="accessories" value={officeAccessories} />
          <input type="hidden" name="reason" value={officeReasons} />
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="size-5 text-primary" /> Office Users
            </h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer">
                <Upload className="size-4" /> Upload Excel
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleOfficeExcelUpload} />
              </label>
              <button
                type="button"
                onClick={addOfficeUser}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="size-4" /> Add User
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            An office pickup bundles multiple users. Add each user manually or upload an Excel/CSV sheet
            with columns like Name, Employee ID, Email, Contact Number, Alternate Contact, Last Working Day,
            Serial Number, Model, Entity, Image Type, Accessories and Reason. Everything is saved on this
            single request as comma-separated lists.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1780px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-input/60 text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Name of User</th>
                  <th className="px-2 py-2 font-medium">Employee ID</th>
                  <th className="px-2 py-2 font-medium">Email ID</th>
                  <th className="px-2 py-2 font-medium">Contact Number</th>
                  <th className="px-2 py-2 font-medium">Alternate Contact</th>
                  <th className="px-2 py-2 font-medium">Last Working Day</th>
                  <th className="px-2 py-2 font-medium">Serial Number</th>
                  <th className="px-2 py-2 font-medium">Laptop Model</th>
                  <th className="px-2 py-2 font-medium">Entity</th>
                  <th className="px-2 py-2 font-medium">Image Type</th>
                  <th className="px-2 py-2 font-medium">Accessories</th>
                  <th className="px-2 py-2 font-medium">Reason</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {officeUsers.map((u, idx) => (
                  <tr key={idx} className="border-b border-input/40">
                    <td className="px-2 py-1.5 align-top">
                      <input type="text" value={u.userName} onChange={e => updateOfficeUser(idx, "userName", e.target.value)} placeholder="Rahul Sharma" className="flex h-10 w-full min-w-[140px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <input type="text" value={u.employeeId} onChange={e => updateOfficeUser(idx, "employeeId", e.target.value)} placeholder="EMP-001" className="flex h-10 w-full min-w-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <input type="text" value={u.emailId} onChange={e => updateOfficeUser(idx, "emailId", e.target.value)} placeholder="name@company.com" className="flex h-10 w-full min-w-[170px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <input type="text" value={u.mobileNumber} onChange={e => updateOfficeUser(idx, "mobileNumber", e.target.value)} placeholder="+91 9876543210" className="flex h-10 w-full min-w-[150px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <input type="text" value={u.contact} onChange={e => updateOfficeUser(idx, "contact", e.target.value)} placeholder="Alternate contact" className="flex h-10 w-full min-w-[150px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <input type="date" value={u.lastWorkingDay} onChange={e => updateOfficeUser(idx, "lastWorkingDay", e.target.value)} className="flex h-10 w-full min-w-[150px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <input type="text" value={u.serialNumber} onChange={e => updateOfficeUser(idx, "serialNumber", e.target.value)} placeholder="SN-12345" className="flex h-10 w-full min-w-[140px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                      <SerialCheckHint check={serialChecks[u.serialNumber.trim()]} />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <input type="text" value={u.model} onChange={e => updateOfficeUser(idx, "model", e.target.value)} placeholder="HP EliteBook" className="flex h-10 w-full min-w-[150px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <select value={u.entity} onChange={e => updateOfficeUser(idx, "entity", e.target.value)} className="flex h-10 w-full min-w-[130px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        <option value="">Select...</option>
                        {(dd?.entity ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <select value={u.imageType} onChange={e => updateOfficeUser(idx, "imageType", e.target.value)} className="flex h-10 w-full min-w-[130px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        <option value="">Select...</option>
                        {(dd?.imageType ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <input type="text" value={u.accessories} onChange={e => updateOfficeUser(idx, "accessories", e.target.value)} placeholder="Charger, mouse..." className="flex h-10 w-full min-w-[150px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <select value={u.reason} onChange={e => updateOfficeUser(idx, "reason", e.target.value)} className="flex h-10 w-full min-w-[130px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        <option value="">Select...</option>
                        {(dd?.reason ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <button
                        type="button"
                        onClick={() => removeOfficeUser(idx)}
                        disabled={officeUsers.length === 1}
                        title="Remove user"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-input text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Asset Details ── */}
      {!isOffice && (
        <div className="rounded-xl glass shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Asset Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ManualInput name="model" label="Laptop Model" required placeholder="e.g. HP EliteBook" value={model} onChange={setModel} />
            <ManualInput name="serialNumber" label="Serial Number" required placeholder="SN-12345" value={serialNumber} onChange={setSerialNumber} hint={<SerialCheckHint check={serialChecks[serialNumber.trim()]} />} />
            <DDField name="entity" label="Entity" category="entity" dd={dd} onAdd={handleAdd} onDelete={handleDelete} value={entity} onChange={setEntity} />
            <DDField name="imageType" label="Image Type" category="imageType" dd={dd} onAdd={handleAdd} onDelete={handleDelete} value={imageType} onChange={setImageType} />
            <ManualInput name="accessories" label="Accessories" placeholder="Charger, mouse, etc." colSpan value={accessories} onChange={setAccessories} />
            <DDField name="reason" label="Reason" category="reason" dd={dd} onAdd={handleAdd} onDelete={handleDelete} />
          </div>
        </div>
      )}

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
          <ManualInput
            name="emailReceivedHour"
            label="Email Received Hour"
            placeholder="10:00 AM"
            value={emailReceivedHour}
            onChange={setEmailReceivedHour}
          />
          <AutoField name="cutOffStatus" label="Cut Off Status" value={cutOffStatus} />
          <AutoField name="slaStartDate" label="SLA Start Date" value={slaStartDate} type="date" />
          <ManualInput name="slaState" label="State (SLA)" placeholder="Manual" />
          <AutoField name="zone1" label="Zone (1)" value={zone1} />
          <AutoField name="tier1" label="Tier 1" value={tier1} />
          <div className="space-y-1.5">
            <label htmlFor="odaLocation" className="text-sm font-medium text-foreground">ODA Location</label>
            <select
              id="odaLocation"
              name="odaLocation"
              value={odaLocation}
              onChange={(e) => setOdaLocation(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="No">ODA: No</option>
              <option value="Yes">ODA: Yes</option>
            </select>
          </div>
          <AutoField name="tat" label="TAT (days)" value={tat} />
          <AutoField name="deliveryTat" label="Delivery TAT" value={tat} />
          <AutoField name="expectedPickupDate" label="Expected Pickup Date" value={expectedPickupDate} type="date" />
          <ManualInput
            name="pickupDate"
            label="Actual Pickup Date"
            type="date"
            value={pickupDate}
            onChange={setPickupDate}
          />
          <ManualInput name="actualDeliveryPodDate" label="Actual Delivery/POD Date" type="date" />
          <AutoField name="sla" label="SLA" value={sla} />
        </div>
        <p className="text-xs text-muted-foreground">
          Cut Off, SLA Start, Zone, Tier, TAT, Expected Pickup Date and SLA are derived automatically.
          Leave the email hour blank and the SLA Start Date defaults to today.
          SLA stays To Be Updated until an actual pickup date is entered, then turns Met or Missed.
        </p>
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
          disabled={pending || blockedSerials.length > 0}
          title={blockedSerials.length > 0 ? "Fix the highlighted serial number before creating the request" : undefined}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-press"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Creating..." : "Create Request"}
        </button>
      </div>
    </form>
  );
}
