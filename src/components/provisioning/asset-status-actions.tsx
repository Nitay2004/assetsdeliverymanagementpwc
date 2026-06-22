"use client";

import { useToast } from "@/hooks/use-toast";
import { updateAssetStatus } from "@/app/actions/provisioning";

export function AssetStatusActions({ assetId, currentStatus }: { assetId: string; currentStatus: string }) {
  const { toast } = useToast();

  const nextStatuses: Record<string, { label: string; status: string }[]> = {
    allocated: [{ label: "Mark QC Pass", status: "qc_pass" }],
    qc_pass: [{ label: "Mark OS Installed", status: "os_installed" }],
  };

  const actions = nextStatuses[currentStatus] ?? [];

  async function handleUpdate(status: string) {
    try {
      await updateAssetStatus(assetId, status);
      toast({ title: "Updated", description: `Asset status changed to "${status}".`, variant: "success" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">Done</span>;
  }

  return (
    <div className="flex gap-2">
      {actions.map((a) => (
        <button
          key={a.status}
          onClick={() => handleUpdate(a.status)}
          className="px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
