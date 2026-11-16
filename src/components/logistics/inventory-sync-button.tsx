"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { syncDeliveredInventoryToLogistics } from "@/app/actions/logistics";
import { useAlert } from "@/hooks/use-alert";
import { useToast } from "@/hooks/use-toast";

interface Props {
  pendingCount: number;
}

/**
 * Materialises Order records for delivered bulk-imported inventory so those
 * assets appear in the Logistics table. Hidden once everything is synced.
 */
export function InventorySyncButton({ pendingCount }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const [syncing, setSyncing] = useState(false);

  if (pendingCount <= 0) return null;

  async function handleSync() {
    const ok = await showAlert({
      title: "Sync delivered inventory?",
      description:
        `${pendingCount} delivered asset${pendingCount === 1 ? "" : "s"} from bulk uploads are not in Logistics yet. ` +
        "They will be grouped by docket/DC into orders. Existing orders are not touched.",
      confirmLabel: "Sync now",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setSyncing(true);
    try {
      const result = await syncDeliveredInventoryToLogistics();
      const created = result.ordersCreated;
      const remaining = result.remaining;

      toast({
        title: created > 0 ? "Inventory synced" : "Nothing to sync",
        description:
          created > 0
            ? `${created} order${created === 1 ? "" : "s"} created for ${result.assetsCreated} asset${result.assetsCreated === 1 ? "" : "s"}.` +
              (remaining > 0 ? ` ${remaining} asset${remaining === 1 ? "" : "s"} still pending — run again.` : "")
            : "No delivered inventory rows needed a new order.",
        variant: "success",
      });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "error" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:bg-indigo-100 disabled:opacity-50"
      title="Create Logistics orders for delivered bulk-imported inventory"
    >
      {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      {syncing ? "Syncing..." : `Sync Inventory (${pendingCount})`}
    </button>
  );
}
