"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Search, Loader2, Plus, ChevronDown } from "lucide-react";
import { addInventoryItem, checkSerialNumber } from "@/app/actions/inventory";
import { getProductByPartNo } from "@/app/actions/product-master";
import { useToast } from "@/hooks/use-toast";
import { useDropdownData, ManageableDropdown } from "@/components/inventory/manageable-dropdown";

interface Props {
  open: boolean;
  onClose: () => void;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(date: Date): string {
  return isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
}

export function NewAssetModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [partNo, setPartNo] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [model, setModel] = useState("");
  const [specs, setSpecs] = useState("");
  const [laptopMake, setLaptopMake] = useState("");
  const [description, setDescription] = useState("");
  const [warrantyStart, setWarrantyStart] = useState(formatDate(new Date()));
  const [warrantyPeriod, setWarrantyPeriod] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const { data: dropdownData, handleAddOption, handleDeleteOption } = useDropdownData();
  const [serialNoError, setSerialNoError] = useState("");

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

  const warrantyEnd = warrantyStart ? formatDate(addMonths(new Date(warrantyStart), 36)) : "";

  async function handlePartNoLookup(val: string) {
    setPartNo(val);
    if (val.length < 2) return;
    setLoadingLookup(true);
    try {
      const product = await getProductByPartNo(val);
      if (!product) {
        setModel("");
        setSpecs("");
        setLaptopMake("");
        setDescription("");
        setWarrantyPeriod("");
        return;
      }
      setLaptopMake(product.make);
      setModel(product.model);
      setSpecs(product.description || "");
      setDescription(product.description || "");
      setWarrantyPeriod(product.warranty || "");
    } finally {
      setLoadingLookup(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partNo.trim() || !model.trim()) {
      toast({ title: "Error", description: "Part number and model are required.", variant: "error" });
      return;
    }

    let finalSerial = serialNo.trim();
    if (!finalSerial) {
      finalSerial = `TEMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    } else {
      if (serialNoError) {
        toast({ title: "Error", description: "Fix errors before submitting.", variant: "error" });
        return;
      }
      const { exists } = await checkSerialNumber(finalSerial);
      if (exists) {
        toast({ title: "Error", description: "Serial number already exists.", variant: "error" });
        return;
      }
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("serialNumber", finalSerial);
      fd.set("model", model);
      fd.set("partNo", partNo.trim());
      fd.set("specs", specs);
      fd.set("laptopMake", laptopMake);
      fd.set("laptopModel", model);
      fd.set("description", description);
      fd.set("invoiceProductDescription", description);
      fd.set("warrantyPeriod", warrantyPeriod);
      fd.set("warrantyEndPeriod", warrantyEnd);
      fd.set("invoicingWarehouse", warehouseLocation);

      await addInventoryItem(fd);
      toast({ title: "Added", description: "New asset added to inventory.", variant: "success" });
      resetForm();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setPartNo("");
    setSerialNo("");
    setModel("");
    setSpecs("");
    setLaptopMake("");
    setDescription("");
    setWarrantyPeriod("");
    setWarrantyStart(formatDate(new Date()));
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-xl border w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Plus className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">New Asset</h2>
              <p className="text-sm text-muted-foreground">Add a new asset to inventory</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="overflow-auto p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Part No <span className="text-destructive">*</span> <span className="text-xs text-muted-foreground">(type to auto-fill)</span>
            </label>
            <div className="relative">
              <input
                value={partNo}
                onChange={e => handlePartNoLookup(e.target.value)}
                placeholder="e.g. PCH-840-G5"
                className="flex h-9 w-full rounded-lg border bg-background pl-3 pr-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {loadingLookup ? (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
              ) : (
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Serial No
            </label>
            <input
              value={serialNo}
              onChange={e => handleSerialNoChange(e.target.value)}
              placeholder="e.g. 5CG12345WW"
              className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {serialNoError && (
              <p className="text-xs text-destructive mt-1">{serialNoError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Model <span className="text-destructive">*</span>
            </label>
            <input
              value={model}
              readOnly
              placeholder="Auto-filled from Part No"
              className="flex h-9 w-full rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Specs</label>
            <input
              value={specs}
              readOnly
              placeholder="Auto-filled from Part No"
              className="flex h-9 w-full rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Laptop Make</label>
            <input
              value={laptopMake}
              readOnly
              placeholder="Auto-filled from Part No"
              className="flex h-9 w-full rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Product Description</label>
            <textarea
              value={description}
              readOnly
              rows={2}
              placeholder="Auto-filled from Part No"
              className="flex w-full rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Warranty Period</label>
            <input
              value={warrantyPeriod}
              readOnly
              placeholder="From Product Master"
              className="flex h-9 w-full rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Warehouse Location</label>
            {dropdownData ? (
              <ManageableDropdown
                name="invoicingWarehouse"
                placeholder="Select warehouse location"
                value={warehouseLocation}
                onChange={setWarehouseLocation}
                options={dropdownData.warehouseLocations}
                allOptions={dropdownData.allOptions}
                category="warehouseLocation"
                onAdd={handleAddOption}
                onDelete={handleDeleteOption}
              />
            ) : (
              <div className="flex h-9 w-full rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground items-center gap-2">
                <ChevronDown className="size-4" />
                Loading...
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Warranty Start Date</label>
              <input
                type="date"
                value={warrantyStart}
                onChange={e => setWarrantyStart(e.target.value)}
                className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Warranty End Date</label>
              <input
                type="date"
                value={warrantyEnd}
                readOnly
                className="flex h-9 w-full rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground focus:outline-none"
              />
              <p className="text-[10px] text-muted-foreground">Start + 36 months</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {saving ? "Adding..." : "Add Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
