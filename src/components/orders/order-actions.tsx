"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { deleteOrder } from "@/app/actions/orders";
import { useRouter } from "next/navigation";

export function OrderActions({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();

  async function handleDelete() {
    const ok = await showAlert({
      title: "Delete order?",
      description: "This will permanently delete the order and all its assets.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    try {
      await deleteOrder(orderId);
      toast({ title: "Deleted", description: "Order deleted successfully.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/dashboard/warehouse/${orderId}`}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Pencil className="size-4" />
      </Link>
      <button
        onClick={handleDelete}
        className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
