"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronDown, Plus, Trash2, Loader2 } from "lucide-react";
import { advanceOrderToProvisioning, getProvisioningDropdowns, addProvisioningDropdownOption, deleteProvisioningDropdownOption } from "@/app/actions/provisioning";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface Props {
  orderId: string;
  open: boolean;
  onClose: () => void;
}

interface DropdownData {
  warehouseLocations: string[];
  provisioningLocations: string[];
  engineerNames: string[];
  allOptions: { id: string; category: string; value: string }[];
}

function DropdownField({
  label,
  value,
  onChange,
  options,
  allOptions,
  category,
  onAdd,
  onDelete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allOptions: { id: string; category: string; value: string }[];
  category: string;
  onAdd: (cat: string, val: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleAdd() {
    if (!newValue.trim() || isAdding) return;
    setIsAdding(true);
    try {
      await onAdd(category, newValue.trim());
      onChange(newValue.trim());
      setNewValue("");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="relative w-full" ref={ref}>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border px-3 py-2 text-sm bg-background text-left min-h-[38px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow ${
          isOpen ? "rounded-t-md border-b-transparent" : "rounded-md"
        }`}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground truncate"}>
          {value || `Select ${label.toLowerCase()}...`}
        </span>
        <ChevronDown className={`size-4 text-muted-foreground shrink-0 ml-2 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full top-full left-0 bg-background border border-t-0 rounded-b-md shadow-lg flex flex-col max-h-[260px] overflow-hidden">
          <div className="overflow-y-auto p-1 space-y-0.5 flex-1 min-h-0">
            <button
              type="button"
              onClick={() => { onChange(""); setIsOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted text-muted-foreground transition-colors"
            >
              Clear selection
            </button>
            {options.map((optVal) => {
              const optItem = allOptions.find(o => o.category === category && o.value === optVal);
              return (
                <div key={optVal} className="group flex items-center justify-between px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors">
                  <button
                    type="button"
                    className="flex-1 text-left truncate mr-2"
                    onClick={() => { onChange(optVal); setIsOpen(false); }}
                  >
                    {optVal}
                  </button>
                  {optItem && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await onDelete(optItem.id);
                        if (value === optVal) onChange("");
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t p-2 bg-muted/30 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                placeholder="Add new option..."
                className="flex-1 min-w-0 rounded-md border px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newValue.trim() || isAdding}
                className="px-3 rounded-md bg-primary text-primary-foreground disabled:opacity-50 flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors"
              >
                {isAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdvanceProvisioningModal({ orderId, open, onClose }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dropdownData, setDropdownData] = useState<DropdownData | null>(null);

  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [provisioningLocation, setProvisioningLocation] = useState("");
  const [engineerName, setEngineerName] = useState("");

  const loadDropdowns = useCallback(async () => {
    const data = await getProvisioningDropdowns();
    setDropdownData(data);
  }, []);

  useEffect(() => {
    if (open) {
      loadDropdowns();
      setWarehouseLocation("");
      setProvisioningLocation("");
      setEngineerName("");
    }
  }, [open, loadDropdowns]);

  async function handleSubmit() {
    if (!warehouseLocation || !provisioningLocation || !engineerName) {
      toast({ title: "Validation", description: "All fields are required.", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      await advanceOrderToProvisioning(orderId, {
        warehouseLocation,
        provisioningLocation,
        engineerName,
      });
      toast({ title: "Advanced", description: "Order moved to provisioning.", variant: "success" });
      router.refresh();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  async function handleAdd(cat: string, val: string) {
    await addProvisioningDropdownOption(cat, val);
    await loadDropdowns();
  }

  async function handleDelete(id: string) {
    await deleteProvisioningDropdownOption(id);
    await loadDropdowns();
  }

  const dd = dropdownData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-visible">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">Advance to Provisioning</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <DropdownField
            label="Warehouse Location"
            value={warehouseLocation}
            onChange={setWarehouseLocation}
            options={dd?.warehouseLocations ?? []}
            allOptions={dd?.allOptions ?? []}
            category="warehouseLocation"
            onAdd={handleAdd}
            onDelete={handleDelete}
          />

          <DropdownField
            label="Provisioning Location"
            value={provisioningLocation}
            onChange={setProvisioningLocation}
            options={dd?.provisioningLocations ?? []}
            allOptions={dd?.allOptions ?? []}
            category="provisioningLocation"
            onAdd={handleAdd}
            onDelete={handleDelete}
          />

          <DropdownField
            label="Engineer Name"
            value={engineerName}
            onChange={setEngineerName}
            options={dd?.engineerNames ?? []}
            allOptions={dd?.allOptions ?? []}
            category="engineerName"
            onAdd={handleAdd}
            onDelete={handleDelete}
          />
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Advancing..." : "Advance to Provisioning"}
          </button>
        </div>
      </div>
    </div>
  );
}
