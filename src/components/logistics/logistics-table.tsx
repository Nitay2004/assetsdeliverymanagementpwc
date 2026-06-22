"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, FileText } from "lucide-react";
import { addDocket, deleteDocket, advanceOrderStatus } from "@/app/actions/logistics";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { useRouter } from "next/navigation";

interface DocketData {
  id: string;
  docketNumber: string | null;
  ewayBillNumber: string | null;
  podDocumentUrl: string | null;
}

interface AssetData {
  id: string;
  inventoryItem: { serialNumber: string } | null;
}

interface OrderData {
  id: string;
  clientName: string;
  deliveryLocation: string;
  totalQuantity: number;
  status: string;
  invoiceNumber: string | null;
  dockets: DocketData[];
  assets: AssetData[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DC_GENERATED:         { label: "DC Generated",        color: "bg-indigo-100 text-indigo-700" },
  PACKED_AND_LABELLED:  { label: "Packed & Labelled",   color: "bg-cyan-100 text-cyan-700" },
  DOCKET_ASSIGNED:      { label: "Docket Assigned",     color: "bg-blue-100 text-blue-700" },
  EWAY_BILL_REQUESTED:  { label: "E-Way Bill Req.",     color: "bg-yellow-100 text-yellow-700" },
  EWAY_BILL_GENERATED:  { label: "E-Way Bill Gen.",     color: "bg-orange-100 text-orange-700" },
  DISPATCHED:           { label: "Dispatched",           color: "bg-purple-100 text-purple-700" },
  DELIVERED:            { label: "Delivered",            color: "bg-green-100 text-green-700" },
};

const STATUS_FLOW = ["DC_GENERATED", "PACKED_AND_LABELLED", "DOCKET_ASSIGNED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED", "DISPATCHED", "DELIVERED"];

interface Props {
  orders: OrderData[];
  canManage: boolean;
}

export function LogisticsTable({ orders, canManage }: Props) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docketForm, setDocketForm] = useState<{ orderId: string; docketNumber: string; ewayBillNumber: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleRow(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  const currentIdx = (status: string) => STATUS_FLOW.indexOf(status);
  const nextStatus = (status: string) => {
    const idx = currentIdx(status);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  async function handleAdvance(orderId: string, status: string) {
    const ns = nextStatus(status);
    if (!ns) return;
    const ok = await showAlert({
      title: `Advance to ${STATUS_LABELS[ns]?.label ?? ns}?`,
      description: "Move this order to the next logistics stage.",
      confirmLabel: "Advance",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await advanceOrderStatus(orderId, ns);
      toast({ title: "Advanced", description: `Order moved to ${STATUS_LABELS[ns]?.label ?? ns}.`, variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setSaving(false); }
  }

  async function handleAddDocket(e: React.FormEvent) {
    e.preventDefault();
    if (!docketForm || !docketForm.docketNumber.trim()) {
      toast({ title: "Error", description: "Docket number is required.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("orderId", docketForm.orderId);
      fd.set("docketNumber", docketForm.docketNumber.trim());
      fd.set("ewayBillNumber", docketForm.ewayBillNumber.trim());
      await addDocket(fd);
      toast({ title: "Added", description: "Docket added.", variant: "success" });
      setDocketForm(null);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setSaving(false); }
  }

  async function handleDeleteDocket(docketId: string) {
    const ok = await showAlert({
      title: "Delete docket?",
      description: "This will permanently remove this docket record.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    try {
      await deleteDocket(docketId);
      toast({ title: "Deleted", description: "Docket removed.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  if (orders.length === 0) {
    return (
      <div className="p-8 rounded-xl glass text-center text-muted-foreground">
        No orders ready for logistics.
      </div>
    );
  }

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold w-10"></th>
              <th className="px-6 py-4 font-semibold">Client</th>
              <th className="px-6 py-4 font-semibold">Location</th>
              <th className="px-6 py-4 font-semibold">Units</th>
              <th className="px-6 py-4 font-semibold">Serial Numbers</th>
              <th className="px-6 py-4 font-semibold">Dockets</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => {
              const isExpanded = expandedId === order.id;
              const ns = nextStatus(order.status);
              const serials = order.assets.filter(a => a.inventoryItem);

              return (
                <tr key={order.id} id={`logistics-${order.id}`} className="scroll-mt-20">
                  <td className="px-6 py-4">
                    <button onClick={() => toggleRow(order.id)}
                      className="p-0.5 rounded hover:bg-muted transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 font-medium">{order.clientName}</td>
                  <td className="px-6 py-4 text-muted-foreground">{order.deliveryLocation}</td>
                  <td className="px-6 py-4">{order.totalQuantity}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {serials.length > 0 ? serials.map(a => (
                        <span key={a.id} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-mono">
                          {a.inventoryItem!.serialNumber}
                        </span>
                      )) : <span className="text-xs text-muted-foreground italic">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {order.dockets.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        <FileText className="size-3.5 text-muted-foreground" />
                        {order.dockets.map(d => d.docketNumber).filter(Boolean).join(", ")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_LABELS[order.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[order.status]?.label ?? order.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {ns && (
                          <button onClick={() => handleAdvance(order.id, order.status)} disabled={saving}
                            className="px-2.5 py-1 rounded text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {STATUS_LABELS[ns]?.label ?? ns}
                          </button>
                        )}
                        <button onClick={() => toggleRow(order.id)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title={isExpanded ? "Close" : "Add Docket"}
                        >
                          <Plus className="size-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded rows */}
      {orders.map((order) => {
        if (expandedId !== order.id) return null;
        const isFormOpen = docketForm?.orderId === order.id;

        return (
          <div key={`expand-${order.id}`} className="border-t px-6 py-5 bg-muted/10 space-y-4">
            {/* Existing dockets */}
            {order.dockets.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dockets</p>
                <div className="space-y-2">
                  {order.dockets.map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-4 p-2.5 rounded-lg bg-background border">
                      <div className="text-sm">
                        <span className="font-mono font-medium">{d.docketNumber}</span>
                        {d.ewayBillNumber && <span className="text-muted-foreground ml-3">E-Way: {d.ewayBillNumber}</span>}
                      </div>
                      {canManage && (
                        <button onClick={() => handleDeleteDocket(d.id)}
                          className="p-1 rounded hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add docket form */}
            {canManage && (
              isFormOpen ? (
                <form onSubmit={handleAddDocket} className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Docket #</label>
                    <input value={docketForm!.docketNumber} onChange={e => setDocketForm({ ...docketForm!, docketNumber: e.target.value })}
                      className="rounded border px-2.5 py-1.5 text-sm bg-background w-40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Required" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">E-Way Bill #</label>
                    <input value={docketForm!.ewayBillNumber} onChange={e => setDocketForm({ ...docketForm!, ewayBillNumber: e.target.value })}
                      className="rounded border px-2.5 py-1.5 text-sm bg-background w-40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Optional" />
                  </div>
                  <button type="submit" disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >{saving ? "Saving..." : "Save"}</button>
                  <button type="button" onClick={() => setDocketForm(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-muted"
                  >Cancel</button>
                </form>
              ) : (
                <button onClick={() => setDocketForm({ orderId: order.id, docketNumber: "", ewayBillNumber: "" })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border hover:bg-muted transition-colors"
                >
                  <Plus className="size-4" /> Add Docket
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
