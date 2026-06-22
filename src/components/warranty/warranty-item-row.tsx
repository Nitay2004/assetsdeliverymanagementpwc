"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { updateItemWarranty } from "@/app/actions/warranty";
import { useRouter } from "next/navigation";

interface ItemData {
  id: string;
  serialNumber: string;
  model: string;
  warrantyPeriod: string | null;
  warrantyEndPeriod: Date | null;
  servicesStartDate: Date | null;
}

function formatDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export function WarrantyItemRow({ item, canManage, elementId }: { item: ItemData; canManage: boolean; elementId?: string }) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [warrantyPeriod, setWarrantyPeriod] = useState(item.warrantyPeriod ?? "");
  const [warrantyEndPeriod, setWarrantyEndPeriod] = useState(formatDate(item.warrantyEndPeriod));
  const [servicesStartDate, setServicesStartDate] = useState(formatDate(item.servicesStartDate));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const ok = await showAlert({
      title: "Save warranty info?",
      description: `Update warranty for ${item.serialNumber}.`,
      confirmLabel: "Save",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("warrantyPeriod", warrantyPeriod);
      fd.set("warrantyEndPeriod", warrantyEndPeriod);
      fd.set("servicesStartDate", servicesStartDate);
      await updateItemWarranty(item.id, fd);
      toast({ title: "Saved", description: "Warranty information updated.", variant: "success" });
      setEditing(false);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr id={elementId} className="hover:bg-muted/10 transition-colors scroll-mt-20">
      <td className="px-6 py-4 font-mono text-sm">{item.serialNumber}</td>
      <td className="px-6 py-4">{item.model}</td>
      <td className="px-6 py-4">{item.warrantyPeriod ?? "—"}</td>
      <td className="px-6 py-4">{formatDate(item.warrantyEndPeriod) || "—"}</td>
      <td className="px-6 py-4">{formatDate(item.servicesStartDate) || "—"}</td>
      {canManage && (
        <td className="px-6 py-4">
          {editing ? (
            <div className="flex flex-col gap-2 min-w-[250px]">
              <input
                value={warrantyPeriod}
                onChange={(e) => setWarrantyPeriod(e.target.value)}
                placeholder="Warranty period (e.g. 3 years)"
                className="rounded border px-2 py-1 text-xs bg-background"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={warrantyEndPeriod}
                  onChange={(e) => setWarrantyEndPeriod(e.target.value)}
                  className="rounded border px-2 py-1 text-xs bg-background flex-1"
                />
                <input
                  type="date"
                  value={servicesStartDate}
                  onChange={(e) => setServicesStartDate(e.target.value)}
                  className="rounded border px-2 py-1 text-xs bg-background flex-1"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-2 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-2 py-1 rounded text-xs font-medium border hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Edit
            </button>
          )}
        </td>
      )}
    </tr>
  );
}
