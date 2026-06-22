"use client";

import { useToast } from "@/hooks/use-toast";
import { advanceOrderToProvisioning } from "@/app/actions/provisioning";
import { useRouter } from "next/navigation";

export function AdvanceProvisioningButton({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const router = useRouter();

  async function handleAdvance() {
    try {
      await advanceOrderToProvisioning(orderId);
      toast({ title: "Advanced", description: "Order moved to provisioning.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  return (
    <button
      onClick={handleAdvance}
      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
    >
      Advance to Provisioning
    </button>
  );
}
