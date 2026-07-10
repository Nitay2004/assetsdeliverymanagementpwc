"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import { addInventoryItem, checkSerialNumber } from "@/app/actions/inventory";
import { fields, toFieldName } from "@/lib/inventory-form-config";
import { useDropdownData, SmartDropdownField } from "@/components/inventory/manageable-dropdown";
import { PincodeInput } from "@/components/shared/pincode-input";
import { getProductsForDropdown, getProductByPartNo } from "@/app/actions/product-master";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";

export default function AddInventoryPage() {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [sections, setSections] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(fields).map(k => [k, true]))
  );
  const { data: dropdownData, handleAddOption, handleDeleteOption } = useDropdownData();
  const [products, setProducts] = useState<{ id: string; make: string; model: string; partNo: string | null }[]>([]);
  const [selectedMake, setSelectedMake] = useState("");
  const [partNo, setPartNo] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [serialNoError, setSerialNoError] = useState("");

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

  let checkTimeout: ReturnType<typeof setTimeout>;
  async function handleSerialNoChange(val: string) {
    setSerialNo(val);
    setSerialNoError("");
    clearTimeout(checkTimeout);
    if (val.trim().length < 2) return;
    checkTimeout = setTimeout(async () => {
      const { exists } = await checkSerialNumber(val.trim());
      if (exists) setSerialNoError("Serial number already exists in inventory.");
    }, 500);
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const ok = await showAlert({
      title: "Add this item?",
      description: "Make sure all details are correct before submitting.",
      confirmLabel: "Submit",
      cancelLabel: "Review",
    });
    if (!ok) return;
    if (serialNoError) {
      toast({ title: "Error", description: "Fix errors before submitting.", variant: "error" });
      return;
    }
    const { exists } = await checkSerialNumber(serialNo.trim());
    if (exists) {
      toast({ title: "Error", description: "Serial number already exists.", variant: "error" });
      return;
    }
    const fd = new FormData(form);
    try {
      await addInventoryItem(fd);
      toast({ title: "Added", description: "Item added to inventory.", variant: "success" });
      router.push("/dashboard/inventory");
    } catch (err: any) {
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Add Inventory Item</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in all details for the new inventory item.</p>
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
                        <PincodeInput required={f.required} />
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

                  if (fieldName === "serialNumber") {
                    return (
                      <div key={f.label} className="space-y-1.5">
                        <label htmlFor={fieldName} className="text-xs font-medium text-foreground">
                          {f.label}{f.required ? <span className="text-destructive"> *</span> : ""}
                        </label>
                        <input
                          id={fieldName}
                          name={fieldName}
                          value={serialNo}
                          onChange={e => handleSerialNoChange(e.target.value)}
                          required={f.required}
                          placeholder="e.g. 5CG12345WW"
                          className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {serialNoError && (
                          <p className="text-xs text-destructive mt-1">{serialNoError}</p>
                        )}
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
                          type={f.type}
                          required={f.required}
                          className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
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
          Add to Inventory
        </button>
      </form>
    </div>
  );
}
