"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { updateOrderFinance, deleteOrder, generateEwayBill } from "@/app/actions/finance";
import { DcGenerateModal } from "@/components/finance/dc-generate-modal";
import { useRouter } from "next/navigation";
import { Download, FileText, ChevronDown, ChevronRight, Trash2, Save, X } from "lucide-react";

interface DcItemData {
  id: string;
  description: string;
  hsnSac: string | null;
  quantity: number;
  rate: number;
  amount: number;
  taxableValue: number | null;
  igstRate: number | null;
  igstAmount: number | null;
}

interface WarehouseData {
  id: string;
  name: string;
  location: string | null;
}

interface DcData {
  id: string;
  dcNumber: string;
  dcDate: string;
  shipToLocation: string | null;
  billToLocation: string | null;
  taxableValue: number | null;
  igst: number | null;
  totalTaxAmount: number | null;
  items: DcItemData[];
  warehouse: WarehouseData | null;
}

interface DocketData {
  id: string;
  docketNumber: string | null;
  ewayBillNumber: string | null;
}

interface AssetItem {
  id: string;
  inventoryItem: { id: string; serialNumber: string } | null;
}

interface OrderData {
  id: string;
  clientName: string;
  deliveryLocation: string;
  totalQuantity: number;
  dcNumber: string | null;
  invoiceNumber: string | null;
  status: string;
  assets: AssetItem[];
  deliveryChallans: DcData[];
  dockets: DocketData[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  IN_PROVISIONING:     { label: "In Provisioning",    color: "bg-purple-100 text-purple-700" },
  DC_REQUESTED:        { label: "DC Requested",       color: "bg-indigo-100 text-indigo-700" },
  DC_GENERATED:        { label: "DC Generated",       color: "bg-indigo-100 text-indigo-700" },
  PACKED_AND_LABELLED: { label: "Packed & Labelled",  color: "bg-cyan-100 text-cyan-700" },
  DOCKET_ASSIGNED:     { label: "Docket Assigned",    color: "bg-blue-100 text-blue-700" },
  EWAY_BILL_REQUESTED: { label: "E-Way Bill Req.",    color: "bg-yellow-100 text-yellow-700" },
  EWAY_BILL_GENERATED: { label: "E-Way Bill Gen.",    color: "bg-orange-100 text-orange-700" },
  DISPATCHED:          { label: "Dispatched",         color: "bg-orange-100 text-orange-700" },
  DELIVERED:                   { label: "Delivered",                    color: "bg-green-100 text-green-700" },
  RTO:                         { label: "RTO",                          color: "bg-red-100 text-red-700" },
  RTO_DC_REQUESTED:            { label: "RTO DC Requested",             color: "bg-red-200 text-red-800" },
  RTO_DC_GENERATED:            { label: "RTO DC Generated",             color: "bg-red-200 text-red-800" },
  RTO_EWAY_BILL_REQUESTED:     { label: "RTO E-Way Bill Requested",    color: "bg-red-200 text-red-800" },
  RTO_EWAY_BILL_GENERATED:     { label: "RTO E-Way Bill Generated",    color: "bg-red-200 text-red-800" },
  RTO_IN_TRANSIT:              { label: "RTO In Transit",              color: "bg-orange-100 text-orange-700" },
  RTO_DELIVERED_TO_WAREHOUSE:  { label: "RTO Delivered to Warehouse",  color: "bg-green-100 text-green-700" },
  DELIVERY_CONFIRMED:          { label: "Del. Confirmed",               color: "bg-teal-100 text-teal-700" },
};

const ALL_STATUSES = Object.keys(STATUS_LABELS);

export function FinanceOrderRow({ order, canManage, elementId }: { order: OrderData; canManage: boolean; elementId?: string }) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDcModal, setShowDcModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [ewayBillInput, setEwayBillInput] = useState("");

  const [formData, setFormData] = useState({
    clientName: order.clientName,
    deliveryLocation: order.deliveryLocation,
    totalQuantity: String(order.totalQuantity),
    dcNumber: order.dcNumber ?? "",
    status: order.status,
  });

  const statusStyle = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };

  async function handleSave() {
    setSaving(true);
    try {
      await updateOrderFinance(order.id, {
        clientName: formData.clientName,
        deliveryLocation: formData.deliveryLocation,
        totalQuantity: parseInt(formData.totalQuantity) || 0,
        dcNumber: formData.dcNumber || "",
        status: formData.status,
      });
      toast({ title: "Saved", description: "Order updated successfully.", variant: "success" });
      setEditMode(false);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    const ok = await showAlert({
      title: "Delete order?",
      description: "This will permanently delete this order and all associated DCs, dockets, and allocations.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await deleteOrder(order.id);
      toast({ title: "Deleted", description: "Order deleted.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setSaving(false); }
  }

  async function handleGenerateEwayBill() {
    if (!ewayBillInput.trim()) {
      toast({ title: "Error", description: "E-Way bill number is required.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      await generateEwayBill(order.id, ewayBillInput.trim());
      toast({ title: "E-Way Bill Generated", description: "E-Way bill number has been saved.", variant: "success" });
      setEwayBillInput("");
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setSaving(false); }
  }

  async function handleDownloadDc(dcId: string) {
    window.open(`/api/dc/${dcId}/pdf`, "_blank");
  }

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <>
      <tr id={elementId} className="hover:bg-muted/10 transition-colors scroll-mt-20">
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <button onClick={() => { setExpanded(!expanded); setEditMode(false); }}
              className="p-0.5 rounded hover:bg-muted transition-colors">
              {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
            </button>
            <span className="font-medium">{order.clientName}</span>
          </div>
        </td>
        <td className="px-6 py-4 text-muted-foreground max-w-[160px] truncate">{order.deliveryLocation}</td>
        <td className="px-6 py-4">{order.totalQuantity}</td>
        <td className="px-6 py-4">
          <div className="flex flex-wrap gap-1">
            {order.assets.filter(a => a.inventoryItem).map(a => (
              <span key={a.id} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-mono">
                {a.inventoryItem!.serialNumber}
              </span>
            ))}
            {order.assets.filter(a => a.inventoryItem).length === 0 && (
              <span className="text-xs text-muted-foreground italic">—</span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 font-mono text-sm">
          <span className="flex items-center gap-1.5">
            {order.dcNumber || <span className="text-muted-foreground italic text-xs">—</span>}
            {order.deliveryChallans.length > 0 && (
              <button onClick={() => handleDownloadDc(order.deliveryChallans[0].id)}
                className="p-0.5 text-muted-foreground hover:text-indigo-600 transition-colors" title="Download DC PDF">
                <Download className="size-3.5" />
              </button>
            )}
          </span>
        </td>
        <td className="px-6 py-4 font-mono text-sm">
          {(order.status === "EWAY_BILL_REQUESTED" || order.status === "RTO_EWAY_BILL_REQUESTED") ? (
            <span className="text-amber-600 text-xs italic">Awaiting Finance</span>
          ) : (
            <span>
              {order.dockets.map(d => d.ewayBillNumber).filter(Boolean).join(", ") || <span className="text-muted-foreground italic text-xs">—</span>}
            </span>
          )}
        </td>
        <td className="px-6 py-4">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle.color}`}>
            {statusStyle.label}
          </span>
        </td>
        {canManage && (
          <td className="px-6 py-4">
            <div className="flex items-center gap-1.5">
              {(order.status === "IN_PROVISIONING" || order.status === "DC_REQUESTED" || order.status === "RTO_DC_REQUESTED") && (
                <button onClick={() => setShowDcModal(true)}
                  className="px-2.5 py-1 rounded text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1">
                  <FileText className="size-3" /> Generate DC
                </button>
              )}
              <button onClick={() => { setExpanded(true); setEditMode(true); }}
                className="px-2.5 py-1 rounded text-xs font-medium border hover:bg-muted transition-colors">
                Edit
              </button>
              <button onClick={handleDelete}
                className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete Order">
                <Trash2 className="size-3.5 text-destructive/70" />
              </button>
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr key={`expand-${order.id}`}>
          <td colSpan={canManage ? 8 : 7} className="px-6 py-4 bg-muted/10 border-t">
            <div className="space-y-4">
              {/* Edit Form */}
              {editMode && canManage && (
                <div className="rounded-lg border bg-background p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Edit Order</h3>
                    <button onClick={() => setEditMode(false)} className="p-0.5 rounded hover:bg-muted transition-colors">
                      <X className="size-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Client Name</label>
                      <input value={formData.clientName} onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                        className="w-full rounded border px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:border-primary" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Delivery Location</label>
                      <input value={formData.deliveryLocation} onChange={e => setFormData({ ...formData, deliveryLocation: e.target.value })}
                        className="w-full rounded border px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:border-primary" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Total Quantity</label>
                      <input type="number" value={formData.totalQuantity} onChange={e => setFormData({ ...formData, totalQuantity: e.target.value })}
                        className="w-full rounded border px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:border-primary" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">DC Number</label>
                      <input value={formData.dcNumber} onChange={e => setFormData({ ...formData, dcNumber: e.target.value })}
                        className="w-full rounded border px-2.5 py-1.5 text-sm bg-background font-mono focus:outline-none focus:border-primary" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Status</label>
                      <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                        className="w-full rounded border px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:border-primary">
                        {ALL_STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]?.label ?? s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setEditMode(false)} className="px-3 py-1.5 rounded text-xs font-medium border hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                      className="px-3 py-1.5 rounded text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                      <Save className="size-3.5" /> {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}

              {/* Delivery Challans */}
              {order.deliveryChallans.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Delivery Challans</p>
                  <div className="space-y-3">
                    {order.deliveryChallans.map(dc => (
                      <div key={dc.id} className="rounded-lg border bg-background p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold text-sm">{dc.dcNumber}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(dc.dcDate)}</span>
                          </div>
                          <button onClick={() => handleDownloadDc(dc.id)}
                            className="px-2 py-1 rounded text-xs font-medium border hover:bg-muted transition-colors flex items-center gap-1">
                            <Download className="size-3" /> Download PDF
                          </button>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="py-1.5 text-left font-medium">Description</th>
                              <th className="py-1.5 text-left font-medium">HSN</th>
                              <th className="py-1.5 text-right font-medium">Qty</th>
                              <th className="py-1.5 text-right font-medium">Rate</th>
                              <th className="py-1.5 text-right font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dc.items.map(item => (
                              <tr key={item.id} className="border-b border-muted/30">
                                <td className="py-1.5">{item.description}</td>
                                <td className="py-1.5 font-mono">{item.hsnSac || "—"}</td>
                                <td className="py-1.5 text-right">{item.quantity}</td>
                                <td className="py-1.5 text-right font-mono">{item.rate.toLocaleString("en-IN")}</td>
                                <td className="py-1.5 text-right font-mono">{item.amount.toLocaleString("en-IN")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {dc.taxableValue && (
                          <div className="flex justify-end gap-6 mt-2 text-xs text-muted-foreground">
                            <span>Taxable: <span className="font-mono font-medium text-foreground">{dc.taxableValue.toLocaleString("en-IN")}</span></span>
                            <span>IGST: <span className="font-mono font-medium text-foreground">{(dc.igst ?? 0).toLocaleString("en-IN")}</span></span>
                            <span>Total Tax: <span className="font-mono font-medium text-foreground">{(dc.totalTaxAmount ?? 0).toLocaleString("en-IN")}</span></span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dockets */}
              {order.dockets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dockets</p>
                  <div className="flex flex-wrap gap-2">
                    {order.dockets.map(d => (
                      <span key={d.id} className="px-2.5 py-1 rounded-md bg-background border text-xs font-mono">
                        {d.docketNumber}
                        {d.ewayBillNumber && <span className="text-orange-600 ml-2">E-Way: {d.ewayBillNumber}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* E-Way Bill Generation (for EWAY_BILL_REQUESTED / RTO_EWAY_BILL_REQUESTED orders) */}
              {(order.status === "EWAY_BILL_REQUESTED" || order.status === "RTO_EWAY_BILL_REQUESTED") && canManage && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <p className="text-xs font-semibold text-yellow-800 mb-2">E-Way Bill Requested</p>
                  <p className="text-xs text-yellow-700 mb-3">Logistics has requested an E-Way bill for this order. Enter the E-Way bill number to complete the request.</p>
                  <div className="flex items-center gap-3">
                    <input value={ewayBillInput} onChange={e => setEwayBillInput(e.target.value)}
                      className="rounded border px-2.5 py-1.5 text-sm bg-background w-60 focus:outline-none focus:border-primary"
                      placeholder="Enter E-Way Bill Number" />
                    <button onClick={handleGenerateEwayBill} disabled={saving}
                      className="px-3 py-1.5 rounded text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors">
                      {saving ? "Saving..." : "Generate E-Way Bill"}
                    </button>
                  </div>
                </div>
              )}

              {!editMode && order.deliveryChallans.length === 0 && order.dockets.length === 0 && order.status !== "EWAY_BILL_REQUESTED" && (
                <p className="text-xs text-muted-foreground italic">No DC or docket details available.</p>
              )}
            </div>
          </td>
        </tr>
      )}
      {showDcModal && createPortal(
        <DcGenerateModal orderId={order.id} open={showDcModal} onClose={() => setShowDcModal(false)} />,
        document.body
      )}
    </>
  );
}
