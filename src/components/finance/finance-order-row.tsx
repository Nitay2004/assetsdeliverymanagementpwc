"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { updateOrderFinance } from "@/app/actions/finance";
import { useRouter } from "next/navigation";

interface OrderData {
  id: string;
  clientName: string;
  deliveryLocation: string;
  totalQuantity: number;
  dcNumber: string | null;
  invoiceNumber: string | null;
  status: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  IN_PROVISIONING:     { label: "In Provisioning",  color: "bg-purple-100 text-purple-700" },
  DC_GENERATED:        { label: "DC Generated",     color: "bg-indigo-100 text-indigo-700" },
  DISPATCHED:          { label: "Dispatched",       color: "bg-orange-100 text-orange-700" },
  DELIVERED:           { label: "Delivered",        color: "bg-green-100 text-green-700" },
  DELIVERY_CONFIRMED:  { label: "Del. Confirmed",   color: "bg-teal-100 text-teal-700" },
  INVOICED:            { label: "Invoiced",         color: "bg-blue-100 text-blue-700" },
  PAYMENT_RECEIVED:    { label: "Payment Received", color: "bg-emerald-100 text-emerald-700" },
};

export function FinanceOrderRow({ order, canManage, elementId }: { order: OrderData; canManage: boolean; elementId?: string }) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [dcNumber, setDcNumber] = useState(order.dcNumber ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(order.invoiceNumber ?? "");
  const [saving, setSaving] = useState(false);

  const statusStyle = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };

  async function handleSaveDC() {
    if (!dcNumber.trim()) {
      toast({ title: "Error", description: "DC number is required.", variant: "error" });
      return;
    }
    const ok = await showAlert({
      title: "Save DC details?",
      description: `Set DC number to "${dcNumber}" and advance status to DC_GENERATED?`,
      confirmLabel: "Save",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await updateOrderFinance(order.id, { dcNumber: dcNumber.trim(), status: "DC_GENERATED" });
      toast({ title: "Saved", description: "DC details updated.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveInvoice() {
    if (!invoiceNumber.trim()) {
      toast({ title: "Error", description: "Invoice number is required.", variant: "error" });
      return;
    }
    const ok = await showAlert({
      title: "Save invoice?",
      description: `Set invoice number to "${invoiceNumber}" and advance status to INVOICED?`,
      confirmLabel: "Save",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await updateOrderFinance(order.id, { invoiceNumber: invoiceNumber.trim(), status: "INVOICED" });
      toast({ title: "Saved", description: "Invoice details updated.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handlePaymentReceived() {
    const ok = await showAlert({
      title: "Mark payment received?",
      description: "This will advance the order to PAYMENT_RECEIVED status.",
      confirmLabel: "Confirm",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await updateOrderFinance(order.id, { status: "PAYMENT_RECEIVED" });
      toast({ title: "Updated", description: "Payment marked as received.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr id={elementId} className="hover:bg-muted/10 transition-colors scroll-mt-20">
      <td className="px-6 py-4 font-medium">{order.clientName}</td>
      <td className="px-6 py-4 text-muted-foreground">{order.deliveryLocation}</td>
      <td className="px-6 py-4">{order.totalQuantity}</td>
      <td className="px-6 py-4 font-mono text-sm">{order.dcNumber ?? "—"}</td>
      <td className="px-6 py-4 font-mono text-sm">{order.invoiceNumber ?? "—"}</td>
      <td className="px-6 py-4">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle.color}`}>
          {statusStyle.label}
        </span>
      </td>
      {canManage && (
        <td className="px-6 py-4">
          {order.status === "IN_PROVISIONING" && (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <div className="flex gap-2 items-center">
                <input
                  value={dcNumber}
                  onChange={(e) => setDcNumber(e.target.value)}
                  placeholder="DC number"
                  className="flex-1 rounded border px-2 py-1 text-xs bg-background"
                />
                <button
                  onClick={handleSaveDC}
                  disabled={saving}
                  className="px-2 py-1 rounded text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save DC
                </button>
              </div>
            </div>
          )}
          {order.status === "DC_GENERATED" && (
            <span className="text-xs text-muted-foreground">Awaiting logistics</span>
          )}
          {(order.status === "DELIVERED" || order.status === "DELIVERY_CONFIRMED") && (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <div className="flex gap-2 items-center">
                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Invoice number"
                  className="flex-1 rounded border px-2 py-1 text-xs bg-background"
                />
                <button
                  onClick={handleSaveInvoice}
                  disabled={saving}
                  className="px-2 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Invoice
                </button>
              </div>
            </div>
          )}
          {order.status === "INVOICED" && (
            <button
              onClick={handlePaymentReceived}
              disabled={saving}
              className="px-2 py-1 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Payment Received
            </button>
          )}
          {order.status === "PAYMENT_RECEIVED" && (
            <span className="text-xs text-green-600 font-medium">Complete</span>
          )}
        </td>
      )}
    </tr>
  );
}
