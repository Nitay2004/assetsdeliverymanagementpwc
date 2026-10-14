"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, ArrowRight } from "lucide-react";
import { assignQcEngineer, getQcDropdowns, addQcDropdownOption, deleteQcDropdownOption, getQcItemLocations } from "@/app/actions/qc";
import { QcDropdownField as DropdownField } from "@/components/warehouse/qc-dropdown-field";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface Props {
  itemId: string;
  open: boolean;
  onClose: () => void;
}

interface DropdownData {
  warehouseLocations: string[];
  qcLocations: string[];
  engineerNames: string[];
  allOptions: { id: string; category: string; value: string }[];
}

export function AssignQcEngineerModal({ itemId, open, onClose }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dropdownData, setDropdownData] = useState<DropdownData | null>(null);

  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [qcLocation, setQcLocation] = useState("");
  const [engineerName, setEngineerName] = useState("");

  const loadData = useCallback(async () => {
    const [data, locs] = await Promise.all([
      getQcDropdowns(),
      getQcItemLocations(itemId),
    ]);
    setDropdownData(data);
    if (locs.warehouseLocation) {
      setWarehouseLocation(locs.warehouseLocation);
    }
    if (locs.qcLocation) {
      setQcLocation(locs.qcLocation);
    }
  }, [itemId]);

  // The modal is mounted only while open (the table renders it behind `assignId`),
  // so nothing needs resetting here — just load the dropdown data.
  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) await loadData();
    })();
    return () => {
      active = false;
    };
  }, [loadData]);

  async function handleSubmit() {
    if (!warehouseLocation || !qcLocation || !engineerName) {
      toast({ title: "Validation", description: "All fields are required.", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      await assignQcEngineer(itemId, {
        engineerName,
        warehouseLocation,
        qcLocation,
      });
      toast({ title: "Assigned", description: "QC engineer assigned.", variant: "success" });
      router.refresh();
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  async function handleAdd(cat: string, val: string) {
    await addQcDropdownOption(cat, val);
    await loadData();
  }

  async function handleDelete(id: string) {
    await deleteQcDropdownOption(id);
    await loadData();
  }

  const dd = dropdownData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-visible">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">Move to QC</h2>
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
            label="QC Location"
            value={qcLocation}
            onChange={setQcLocation}
            options={dd?.qcLocations ?? []}
            allOptions={dd?.allOptions ?? []}
            category="warehouseLocation"
            onAdd={handleAdd}
            onDelete={handleDelete}
          />

          <DropdownField
            label="QC Engineer Name"
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
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Assigning..." : "Assign & Start QC"}
            {!loading && <ArrowRight className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
