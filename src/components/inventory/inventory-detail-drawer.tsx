"use client";

import { useState, useEffect } from "react";
import { X, Pencil, RotateCcw, ArrowRight, History, User, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { fields, toFieldName } from "@/lib/inventory-form-config";
import { returnItemToStock, reassignItem, getAssignmentHistory, getInventoryItem, getDistinctFieldValues, addDropdownOption, deleteDropdownOption, seedDropdownOptions } from "@/app/actions/inventory";
import { ManageableDropdown } from "@/components/inventory/manageable-dropdown";
import { PincodeInput } from "@/components/shared/pincode-input";

interface InventoryItem {
  id: string;
  serialNumber: string;
  model: string;
  specs: string | null;
  status: string;
  partner: string | null;
  sr: number | null;
  entity: string | null;
  userBaseLocation: string | null;
  imageType: string | null;
  purpose: string | null;
  requestDate: string | null;
  count: number | null;
  employeeName: string | null;
  emailId: string | null;
  shippingAddress: string | null;
  landMark: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  mobileNumber: string | null;
  pwcRemarks: string | null;
  laptopMake: string | null;
  laptopModel: string | null;
  invoiceProductDescription: string | null;
  description: string | null;
  emailReceivedHour: string | null;
  cutOffStatus: string | null;
  slaStartDate: string | null;
  slaState: string | null;
  zone: string | null;
  tier: string | null;
  odaLocation: string | null;
  tat: string | null;
  deliveryTatDays: number | null;
  actualDeliveryDate: string | null;
  slaStatus: string | null;
  laptopAcceptanceDate: string | null;
  invoicedQuantity: number | null;
  warrantyPeriod: string | null;
  warrantyEndPeriod: string | null;
  customerInstructionDoc: string | null;
  adaptorAdded: string | null;
  accessoryHeadsetMouse: string | null;
  stickerColour: string | null;
  deliveryDate: string | null;
  dc: string | null;
  vendor: string | null;
  deliveredLocation: string | null;
  docketNumber: string | null;
  trackingStatus: string | null;
  trackingSubStatus: string | null;
  pickupDate: string | null;
  alternatePhoneNumber: string | null;
  processStatus: string | null;
  machineWs1Status: string | null;
  serialNoInWs1: string | null;
  dateOfWs1Update: string | null;
  servicesStartDate: string | null;
  invoicingWarehouse: string | null;
  boxSerialNo: string | null;
  checkField: string | null;
  remark: string | null;
  dcNumber: string | null;
  date: string | null;
  csvStatus: string | null;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return v.toLocaleDateString("en-CA");
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("en-CA");
  }
  return String(v);
}

function getValue(item: InventoryItem, fieldName: string): string {
  const key = fieldName as keyof InventoryItem;
  return formatValue(item[key]);
}

interface HistoryRecord {
  id: string;
  employeeName: string | null;
  emailId: string | null;
  mobileNumber: string | null;
  alternatePhoneNumber: string | null;
  shippingAddress: string | null;
  landMark: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  purpose: string | null;
  requestDate: string | null;
  userBaseLocation: string | null;
  imageType: string | null;
  count: number | null;
  pwcRemarks: string | null;
  trackingStatus: string | null;
  trackingSubStatus: string | null;
  dcNumber: string | null;
  docketNumber: string | null;
  deliveryDate: string | null;
  assignedAt: string;
}

function statusColor(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("delivered") || v.includes("confirmed") || v.includes("received")) return "bg-green-100 text-green-700";
  if (v.includes("dispatched") || v.includes("invoiced") || v.includes("payment")) return "bg-emerald-100 text-emerald-700";
  if (v.includes("allocated")) return "bg-blue-100 text-blue-700";
  if (v.includes("provisioning") || v.includes("dc generated") || v.includes("packed") || v.includes("labelled")) return "bg-indigo-100 text-indigo-700";
  if (v.includes("docket") || v.includes("eway")) return "bg-cyan-100 text-cyan-700";
  if (v.includes("placed") || v.includes("pending")) return "bg-yellow-100 text-yellow-700";
  if (v.includes("order")) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function AssignmentCard({ record, index, item }: { record: HistoryRecord; index: number; item: InventoryItem }) {
  const [open, setOpen] = useState(index === 0);
  const label = index === 0 ? "Current Assignment" : `Previous #${index}`;

  function assignValue(fieldName: string): string {
    const recordKey = fieldName as keyof HistoryRecord;
    if (recordKey in record && record[recordKey] != null) {
      return formatValue(record[recordKey]);
    }
    const itemKey = fieldName as keyof InventoryItem;
    return formatValue(item[itemKey]);
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <User className="size-3 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-muted-foreground">{label}</span>
          <p className="text-sm font-medium truncate">{record.employeeName || "—"}</p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {new Date(record.assignedAt).toLocaleDateString("en-CA")}
        </span>
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-4">
          {Object.entries(fields).map(([section, sectionFields]) => (
            <div key={section}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 pb-1 border-b">
                {section}
              </h4>
              <div className="space-y-1.5">
                {sectionFields.map((field) => {
                  const fieldName = toFieldName(field.label);
                  const value = assignValue(fieldName);
                  return (
                    <div key={fieldName} className="flex items-start gap-3">
                      <span className="text-xs text-muted-foreground w-36 shrink-0">{field.label}</span>
                      <span className="text-sm text-foreground font-medium break-words min-w-0">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InventoryDetailDrawer({
  item,
  isAdmin,
  onClose,
}: {
  item: InventoryItem;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { showAlert } = useAlert();

  const [showReassign, setShowReassign] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[] | null>(null);
  const [displayItem, setDisplayItem] = useState(item);
  const [entities, setEntities] = useState<string[]>([]);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [imageTypes, setImageTypes] = useState<string[]>([]);
  const [adaptorAddeds, setAdaptorAddeds] = useState<string[]>([]);
  const [accessoryHeadsetMouses, setAccessoryHeadsetMouses] = useState<string[]>([]);
  const [stickerColours, setStickerColours] = useState<string[]>([]);
  const [allOptions, setAllOptions] = useState<{ id: string; category: string; value: string }[]>([]);

  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedPurpose, setSelectedPurpose] = useState("");
  const [selectedImageType, setSelectedImageType] = useState("");
  const [selectedAdaptor, setSelectedAdaptor] = useState("");
  const [selectedHeadset, setSelectedHeadset] = useState("");
  const [selectedSticker, setSelectedSticker] = useState("");

  useEffect(() => {
    setDisplayItem(item);
    getAssignmentHistory(item.id).then(setRecords);
  }, [item]);

  useEffect(() => {
    getDistinctFieldValues().then((v) => {
      setAllOptions(v.allOptions);
      const hasNone = v.entities.length === 0 && v.purposes.length === 0 && v.imageTypes.length === 0
        && v.adaptorAddeds.length === 0 && v.accessoryHeadsetMouses.length === 0 && v.stickerColours.length === 0;
      if (hasNone) {
        seedDropdownOptions().then(() =>
          getDistinctFieldValues().then((v2) => {
            setEntities(v2.entities);
            setPurposes(v2.purposes);
            setImageTypes(v2.imageTypes);
            setAdaptorAddeds(v2.adaptorAddeds);
            setAccessoryHeadsetMouses(v2.accessoryHeadsetMouses);
            setStickerColours(v2.stickerColours);
            setAllOptions(v2.allOptions);
          })
        );
      } else {
        setEntities(v.entities);
        setPurposes(v.purposes);
        setImageTypes(v.imageTypes);
        setAdaptorAddeds(v.adaptorAddeds);
        setAccessoryHeadsetMouses(v.accessoryHeadsetMouses);
        setStickerColours(v.stickerColours);
      }
    });
  }, []);

  async function refreshDropdowns() {
    const v = await getDistinctFieldValues();
    setEntities(v.entities);
    setPurposes(v.purposes);
    setImageTypes(v.imageTypes);
    setAdaptorAddeds(v.adaptorAddeds);
    setAccessoryHeadsetMouses(v.accessoryHeadsetMouses);
    setStickerColours(v.stickerColours);
    setAllOptions(v.allOptions);
  }

  async function handleAddOption(category: "entity" | "purpose" | "imageType" | "adaptorAdded" | "accessoryHeadsetMouse" | "stickerColour", value: string) {
    if (!value.trim()) return;
    await addDropdownOption(category, value.trim());
    await refreshDropdowns();
    toast({ title: "Added", description: `"${value.trim()}" added to ${category}.`, variant: "success" });
  }

  async function handleDeleteOption(id: string) {
    await deleteDropdownOption(id);
    await refreshDropdowns();
    toast({ title: "Deleted", description: "Value removed.", variant: "success" });
  }

  async function handleReturnToStock() {
    const ok = await showAlert({
      title: "Return to stock?",
      description: `Mark ${displayItem.serialNumber} as AVAILABLE. All assignment history is preserved.`,
      confirmLabel: "Return",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    try {
      await returnItemToStock(displayItem.id);
      const updated = await getInventoryItem(displayItem.id);
      if (updated) setDisplayItem(updated as InventoryItem);
      toast({ title: "Returned", description: "Item returned to stock.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  async function handleReassign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setReassigning(true);
    try {
      await reassignItem(displayItem.id, fd);
      const updated = await getInventoryItem(displayItem.id);
      if (updated) setDisplayItem(updated as InventoryItem);
      toast({ title: "Assigned", description: "New assignment recorded.", variant: "success" });
      setShowReassign(false);
      setRecords(null);
      getAssignmentHistory(displayItem.id).then(setRecords);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setReassigning(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 animate-in fade-in"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-background shadow-2xl z-50 overflow-y-auto animate-in slide-in-from-right">
        <div className="sticky top-0 bg-background border-b flex items-center justify-between px-6 py-4 z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{displayItem.serialNumber}</h2>
            <p className="text-xs text-muted-foreground truncate">{displayItem.model}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <Link
                href={`/dashboard/inventory/${displayItem.id}`}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Pencil className="size-3.5" />
                Edit
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Status badge */}
          <div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              displayItem.status === "NEW" ? "bg-purple-100 text-purple-700" :
              displayItem.status === "AVAILABLE" ? "bg-green-100 text-green-700" :
              displayItem.status === "ALLOCATED" ? "bg-blue-100 text-blue-700" :
              "bg-red-100 text-red-700"
            }`}>
              {displayItem.status}
            </span>
          </div>

          {/* All Assignments */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <History className="size-4" />
              Assignments
            </h3>

            {records === null ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : records.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No assignment records yet.
              </div>
            ) : (
              <div className="space-y-2">
                {records.map((r, i) => (
                  <AssignmentCard key={r.id} record={r} index={i} item={displayItem} />
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          {isAdmin && (
            <div className="space-y-3">
              {displayItem.status === "ALLOCATED" && (
                <button
                  onClick={handleReturnToStock}
                  className="flex items-center gap-2 rounded-lg bg-amber-100 text-amber-800 px-3 py-2 text-sm font-medium hover:bg-amber-200 transition-colors w-full"
                >
                  <RotateCcw className="size-4" />
                  Return to Stock
                </button>
              )}

              {!showReassign && (
                <button
                  onClick={() => setShowReassign(true)}
                  className="flex items-center gap-2 rounded-lg bg-blue-100 text-blue-800 px-3 py-2 text-sm font-medium hover:bg-blue-200 transition-colors w-full"
                >
                  <ArrowRight className="size-4" />
                  {records && records.length > 0 ? "Assign to New User" : "Assign This Laptop"}
                </button>
              )}

              {showReassign && (
                <form onSubmit={handleReassign} className="rounded-lg border p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    New Assignment for {displayItem.serialNumber}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <input name="partner" placeholder="Partner" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                    <input name="sr" placeholder="Sr #" type="number" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                    <ManageableDropdown
                      name="entity"
                      placeholder="Entity"
                      value={selectedEntity}
                      onChange={setSelectedEntity}
                      options={entities}
                      allOptions={allOptions}
                      category="entity"
                      onAdd={handleAddOption as any}
                      onDelete={handleDeleteOption}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input name="employeeName" placeholder="Employee Name" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                    <input name="emailId" type="email" placeholder="Email ID" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input name="mobileNumber" placeholder="Mobile Number" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                    <input name="alternatePhoneNumber" placeholder="Alternate Phone" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  </div>
                  
                  <input name="shippingAddress" placeholder="Shipping Address" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  
                  <PincodeInput />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <ManageableDropdown
                        name="purpose"
                        placeholder="Purpose"
                        value={selectedPurpose}
                        onChange={setSelectedPurpose}
                        options={purposes}
                        allOptions={allOptions}
                        category="purpose"
                        onAdd={handleAddOption as any}
                        onDelete={handleDeleteOption}
                      />
                    </div>
                    <div>
                      <ManageableDropdown
                        name="imageType"
                        placeholder="Image Type"
                        value={selectedImageType}
                        onChange={setSelectedImageType}
                        options={imageTypes}
                        allOptions={allOptions}
                        category="imageType"
                        onAdd={handleAddOption as any}
                        onDelete={handleDeleteOption}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Request Date</label>
                      <input name="requestDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Count</label>
                      <input name="count" type="number" min="1" defaultValue="1" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                    </div>
                  </div>

                  <div className="pt-2 border-t mt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Timeline & SLA</p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input name="emailReceivedHour" placeholder="Email Received Hour" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                      <input name="cutOffStatus" placeholder="Cut Off Status" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">SLA Start Date <span className="text-red-500">*</span></label>
                        <input name="slaStartDate" type="date" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Actual Delivery Date</label>
                        <input name="actualDeliveryDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <input name="slaState" placeholder="State (SLA)" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                      <input name="zone" placeholder="Zone" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                      <input name="tier" placeholder="Tier" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <input name="odaLocation" placeholder="ODA Location" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                      <input name="tat" placeholder="TAT" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                      <input name="deliveryTatDays" placeholder="Delivery TAT (Days)" type="number" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input name="slaStatus" placeholder="SLA Missed/Met" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Acceptance Date</label>
                        <input name="laptopAcceptanceDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t mt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Accessories & Setup</p>
                    <div className="grid grid-cols-3 gap-2">
                      <ManageableDropdown
                        name="adaptorAdded"
                        placeholder="Adaptor Added"
                        value={selectedAdaptor}
                        onChange={setSelectedAdaptor}
                        options={adaptorAddeds}
                        allOptions={allOptions}
                        category="adaptorAdded"
                        onAdd={handleAddOption as any}
                        onDelete={handleDeleteOption}
                        required
                      />
                      <ManageableDropdown
                        name="accessoryHeadsetMouse"
                        placeholder="Headset/Mouse"
                        value={selectedHeadset}
                        onChange={setSelectedHeadset}
                        options={accessoryHeadsetMouses}
                        allOptions={allOptions}
                        category="accessoryHeadsetMouse"
                        onAdd={handleAddOption as any}
                        onDelete={handleDeleteOption}
                        required
                      />
                      <ManageableDropdown
                        name="stickerColour"
                        placeholder="Sticker Colour"
                        value={selectedSticker}
                        onChange={setSelectedSticker}
                        options={stickerColours}
                        allOptions={allOptions}
                        category="stickerColour"
                        onAdd={handleAddOption as any}
                        onDelete={handleDeleteOption}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={reassigning} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      {reassigning ? "Saving..." : "Save Assignment"}
                    </button>
                    <button type="button" onClick={() => setShowReassign(false)} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Hardware & Specs */}
          {Object.entries(fields).map(([section, sectionFields]) => (
            <div key={section}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-1 border-b">
                {section}
              </h3>
              <div className="space-y-2.5">
                {sectionFields.map((field) => {
                  const fieldName = toFieldName(field.label);
                  const value = getValue(displayItem, fieldName);
                  const isStatus = fieldName === "status" || fieldName === "trackingStatus";
                  return (
                    <div key={fieldName} className="flex items-start gap-3">
                      <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">
                        {field.label}
                      </span>
                      {isStatus && value !== "—" ? (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          fieldName === "status"
                            ? value === "NEW" ? "bg-purple-100 text-purple-700"
                            : value === "AVAILABLE" ? "bg-green-100 text-green-700"
                            : value === "ALLOCATED" ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                            : statusColor(value)
                        }`}>
                          {value}
                        </span>
                      ) : (
                        <span className="text-sm text-foreground font-medium break-words min-w-0">
                          {value}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
