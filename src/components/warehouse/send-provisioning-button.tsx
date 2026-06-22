"use client";

import { useState } from "react";
import { updateOrderStatus } from "@/app/actions/warehouse";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function SendToProvisioningButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSend() {
    setLoading(true);
    try {
      await updateOrderStatus(orderId, "ALLOCATED");
      toast({ title: "Sent to Provisioning", variant: "success" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
    >
      {loading ? "Sending..." : "Send to Provisioning"}
      <ArrowRight className="size-4" />
    </button>
  );
}
