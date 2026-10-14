"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, ArrowRight, UserCog } from "lucide-react";
import { assignReverseQcEngineer } from "@/app/actions/reverse-pickup";
import { getQcDropdowns, addQcDropdownOption, deleteQcDropdownOption } from "@/app/actions/qc";
import { QcDropdownField } from "@/components/warehouse/qc-dropdown-field";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export interface AssignReverseQcItem {
  id: string;
  requestNumber: string;
  serialNumber: string;
  warehouseLocation: string | null;
  qcEngineer: string | null;
  qcLocation: string | null;
}

interface Props {
  item: AssignReverseQcItem;
  open: boolean;
  onClose: () => void;
}

interface DropdownData {
  warehouseLocations: string[];
  qcLocations: string[];
  engineerNames: string[];
  allOptions: { id: string; category: string; value: string }[];
}

/**
 * Warehouse assigns a QC engineer for a received reverse unit. Once assigned the
 * unit appears in that engineer's "my tasks" queue in the Provisioning module,
 * where the hardware / software QC is actually recorded.
 */
export function AssignReverseQcModal({ item, open, onClose }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dropdownData, setDropdownData] = useState<DropdownData | null>(null);

  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [qcLocation, setQcLocation] = useState("");
  const [engineerName, setEngineerName] = useState("");

  const loadData = useCallback(async () => {
    const data = await getQcDropdowns();
    setDropdownData(data);
  }, []);

  // The modal is mounted only while open (the table renders it behind
  // `assignItem`), so the values can be seeded from the item directly.
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
    if (!engineerName.trim()) {
      toast({ title: "Validation", description: "QC engineer is required.", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("id", item.id);
      fd.set("qcEngineer", engineerName.trim());
      fd.set("qcLocation", qcLocation);
      fd.set("warehouseLocation", warehouseLocation);
      await assignReverseQcEngineer(fd);
      toast({
        title: "QC engineer assigned",
        description: `${item.serialNumber} assigned to ${engineerName.trim()}.`,
        variant: "success",
      });
      router.refresh();
      onClose();
    } catch (err) {
      toast({ title: "Action failed", description: String(err), variant: "error" });
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
          <div className="flex items-center gap-2">
            <UserCog className="size-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-foreground">Assign QC Engineer</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{item.serialNumber}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Request {item.requestNumber}</p>
          </div>

          <QcDropdownField
            label="Warehouse Location"
            value={warehouseLocation}
            onChange={setWarehouseLocation}
            options={dd?.warehouseLocations ?? []}
            allOptions={dd?.allOptions ?? []}
            category="warehouseLocation"
            onAdd={handleAdd}
            onDelete={handleDelete}
          />

          <QcDropdownField
            label="QC Location"
            value={qcLocation}
            onChange={setQcLocation}
            options={dd?.qcLocations ?? []}
            allOptions={dd?.allOptions ?? []}
            category="warehouseLocation"
            onAdd={handleAdd}
            onDelete={handleDelete}
          />

          <QcDropdownField
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
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Assigning..." : item.qcEngineer ? "Reassign QC Engineer" : "Assign QC Engineer"}
            {!loading && <ArrowRight className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
