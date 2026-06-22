"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { addOrder, updateOrder } from "@/app/actions/orders";

interface OrderData {
  id?: string;
  clientName: string;
  intermediary: string;
  totalQuantity: number;
  deliveryLocation: string;
}

export function OrderForm({ order }: { order?: OrderData }) {
  const router = useRouter();
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const isEdit = !!order?.id;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const ok = await showAlert({
      title: isEdit ? "Save changes?" : "Create order?",
      description: isEdit
        ? "This will update the order details."
        : "This will create a new order with the specified quantity.",
      confirmLabel: isEdit ? "Save" : "Create",
      cancelLabel: "Review",
    });
    if (!ok) return;

    const fd = new FormData(form);
    try {
      if (isEdit) {
        await updateOrder(order!.id!, fd);
      } else {
        await addOrder(fd);
      }
      toast({
        title: isEdit ? "Saved" : "Created",
        description: isEdit ? "Order updated successfully." : "Order created successfully.",
        variant: "success",
      });
      router.push("/dashboard/warehouse");
    } catch (err: any) {
      if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="clientName" className="text-sm font-medium">Client Name</label>
          <input
            id="clientName"
            name="clientName"
            defaultValue={order?.clientName ?? "PWC"}
            required
            className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="intermediary" className="text-sm font-medium">Intermediary</label>
          <input
            id="intermediary"
            name="intermediary"
            defaultValue={order?.intermediary ?? "HP"}
            required
            className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="deliveryLocation" className="text-sm font-medium">Delivery Location</label>
          <input
            id="deliveryLocation"
            name="deliveryLocation"
            defaultValue={order?.deliveryLocation}
            required
            className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="totalQuantity" className="text-sm font-medium">Total Quantity</label>
          <input
            id="totalQuantity"
            name="totalQuantity"
            type="number"
            min="1"
            defaultValue={order?.totalQuantity ?? 1}
            required
            className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {isEdit ? "Save Changes" : "Create Order"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
