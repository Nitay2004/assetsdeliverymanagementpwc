"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import { updateInventoryItem } from "@/app/actions/inventory";
import { fields, toFieldName } from "@/lib/inventory-form-config";
import { useDropdownData, SmartDropdownField } from "@/components/inventory/manageable-dropdown";
import { PincodeInput } from "@/components/shared/pincode-input";
import { getProductsForDropdown, getProductByPartNo } from "@/app/actions/product-master";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";

interface Item {
  id: string;
  serialNumber: string;
  model: string;
  partNo: string | null;
  specs: string | null;
  status: string;
  partner: string | null;
  sr: number | null;
  entity: string | null;
  userBaseLocation: string | null;
  imageType: string | null;
  purpose: string | null;
  requestDate: Date | null;
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
  slaStartDate: Date | null;
  slaState: string | null;
  zone: string | null;
  tier: string | null;
  odaLocation: string | null;
  tat: string | null;
  deliveryTatDays: number | null;
  actualDeliveryDate: Date | null;
  slaStatus: string | null;
  laptopAcceptanceDate: Date | null;
  invoicedQuantity: number | null;
  warrantyPeriod: string | null;
  warrantyEndPeriod: Date | null;
  customerInstructionDoc: string | null;
  adaptorAdded: string | null;
  accessoryHeadsetMouse: string | null;
  stickerColour: string | null;
  deliveryDate: Date | null;
  dc: string | null;
  vendor: string | null;
  deliveredLocation: string | null;
  docketNumber: string | null;
  trackingStatus: string | null;
  trackingSubStatus: string | null;
  pickupDate: Date | null;
  alternatePhoneNumber: string | null;
  processStatus: string | null;
  machineWs1Status: string | null;
  serialNoInWs1: string | null;
  dateOfWs1Update: Date | null;
  servicesStartDate: Date | null;
  invoicingWarehouse: string | null;
  boxSerialNo: string | null;
  checkField: string | null;
  remark: string | null;
  dcNumber: string | null;
  date: Date | null;
  csvStatus: string | null;
}

export function EditInventoryForm({ item }: { item: Item }) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [sections, setSections] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(fields).map(k => [k, true]))
  );
  const { data: dropdownData, handleAddOption, handleDeleteOption } = useDropdownData();
  const [products, setProducts] = useState<{ id: string; make: string; model: string; partNo: string | null }[]>([]);
  const [selectedMake, setSelectedMake] = useState(item.laptopMake ?? "");
  const [partNo, setPartNo] = useState(item.partNo ?? "");

  useEffect(() => {
    getProductsForDropdown().then(setProducts);
  }, []);

  const makes = [...new Set(products.map(p => p.make))].sort();
  const filteredModels = products.filter(p => p.make === selectedMake);

  function setFormValue(name: string, value: string) {
    const el = formRef.current?.elements.namedItem(name);
    if (!el || el instanceof RadioNodeList) return;
    (el as HTMLInputElement | HTMLSelectElement).value = value;
  }

  async function handlePartNoLookup(val: string) {
    setPartNo(val);
    if (val.length < 2) return;
    const product = await getProductByPartNo(val);
    if (!product) return;

    setSelectedMake(product.make);

    setTimeout(() => {
      setFormValue("laptopModel", product.model);
      setFormValue("description", product.description || "");
      setFormValue("warrantyPeriod", product.warranty || "");
      setFormValue("invoiceProductDescription", product.description || "");
      setFormValue("specs", product.description || "");
    }, 50);
  }

  function formatDate(value: Date | string | null): string {
    if (!value) return "";
    const d = typeof value === "string" ? new Date(value) : value;
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
  }

  function getValue(field: string): string | number | undefined {
    const key = field as keyof Item;
    const val = item[key];
    if (val === null || val === undefined) return undefined;
    if (val instanceof Date) return formatDate(val) as unknown as number;
    if (typeof val === "number") return val;
    return String(val);
  }

  function getType(type: string): string {
    if (type === "date") return "text";
    return type;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const ok = await showAlert({
      title: "Save changes?",
      description: "This will update the inventory item record.",
      confirmLabel: "Save",
      cancelLabel: "Review",
    });
    if (!ok) return;
    const fd = new FormData(form);
    try {
      await updateInventoryItem(item.id, fd);
      toast({ title: "Saved", description: "Item updated successfully.", variant: "success" });
      router.push("/dashboard/inventory");
    } catch (err: any) {
      if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory"
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Inventory Item</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Update details for {item.serialNumber}.</p>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {Object.entries(fields).map(([section, sectionFields]) => (
          <div key={section} className="rounded-xl glass shadow-sm">
            <button
              type="button"
              onClick={() => setSections(s => ({ ...s, [section]: !s[section] }))}
              className={`w-full flex items-center gap-2 p-4 text-left text-sm font-semibold text-foreground bg-muted/20 hover:bg-muted/40 transition-colors ${sections[section] ? "rounded-t-xl" : "rounded-xl"}`}
            >
              {sections[section] ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              {section}
            </button>
            {sections[section] && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sectionFields.map(f => {
                  const fieldName = toFieldName(f.label);

                  if (fieldName === "city" || fieldName === "state") return null;

                  if (fieldName === "pinCode") {
                    return (
                      <div key={f.label} className="sm:col-span-2">
                        <PincodeInput
                          required={f.required}
                          defaultPincode={String(getValue(fieldName) ?? "")}
                          defaultCity={String(getValue("city") ?? "")}
                          defaultState={String(getValue("state") ?? "")}
                        />
                      </div>
                    );
                  }

                  if (fieldName === "partNo") {
                    return (
                      <div key={f.label} className="space-y-1.5">
                        <label htmlFor={fieldName} className="text-xs font-medium text-foreground">
                          Part No <span className="text-xs text-muted-foreground">(type to auto-fill)</span>
                        </label>
                        <div className="relative">
                          <input
                            id={fieldName}
                            name={fieldName}
                            value={partNo}
                            onChange={e => handlePartNoLookup(e.target.value)}
                            placeholder="e.g. PCH-840-G5"
                            className="flex h-9 w-full rounded-lg border bg-background pl-3 pr-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    );
                  }

                  if (fieldName === "laptopMake") {
                    return (
                      <div key={f.label} className="space-y-1.5">
                        <label htmlFor={fieldName} className="text-xs font-medium text-foreground">
                          {f.label}
                        </label>
                        <select
                          id={fieldName}
                          name={fieldName}
                          value={selectedMake}
                          onChange={e => { setSelectedMake(e.target.value); }}
                          className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">Select Make</option>
                          {makes.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    );
                  }

                  if (fieldName === "laptopModel") {
                    return (
                      <div key={f.label} className="space-y-1.5">
                        <label htmlFor={fieldName} className="text-xs font-medium text-foreground">
                          {f.label}
                        </label>
                        <select
                          id={fieldName}
                          name={fieldName}
                          defaultValue={getValue(fieldName) ?? ""}
                          disabled={!selectedMake}
                          className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        >
                          <option value="">Select Model</option>
                          {filteredModels.map(p => <option key={p.id} value={p.model}>{p.model}</option>)}
                        </select>
                      </div>
                    );
                  }

                  const isDropdown = fieldName === "entity" || fieldName === "purpose" || fieldName === "imageType" || fieldName === "invoicingWarehouse";

                  return (
                    <div key={f.label} className="space-y-1.5">
                      <label htmlFor={fieldName} className="text-xs font-medium text-foreground">
                        {f.label}{f.required ? <span className="text-destructive"> *</span> : ""}
                      </label>
                      {isDropdown && dropdownData ? (
                        <SmartDropdownField
                          name={fieldName}
                          defaultValue={getValue(fieldName)}
                          placeholder={f.label}
                          category={fieldName === "invoicingWarehouse" ? "warehouseLocation" : fieldName}
                          options={dropdownData[fieldName === "entity" ? "entities" : fieldName === "purpose" ? "purposes" : fieldName === "imageType" ? "imageTypes" : "warehouseLocations"]}
                          allOptions={dropdownData.allOptions}
                          onAdd={handleAddOption}
                          onDelete={handleDeleteOption}
                          required={f.required}
                        />
                      ) : (
                        <input
                          id={fieldName}
                          name={fieldName}
                          type={getType(f.type)}
                          defaultValue={getValue(fieldName)}
                          required={f.required}
                          className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      )}
                      {f.type === "date" && (
                        <span className="text-[10px] text-muted-foreground block leading-tight">
                          Format: YYYY-MM-DD
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
