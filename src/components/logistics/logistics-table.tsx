"use client";

import { useState, Fragment, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Plus, Trash2, Download, FileText, Edit3, RotateCcw, X } from "lucide-react";
import { addDocket, updateDocket, updateDocketPod, deleteDocket, advanceOrderStatus, markAsRto } from "@/app/actions/logistics";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { useRouter } from "next/navigation";
import { ScrollToItem } from "@/components/shared/scroll-to-item";
import { DataTableFilter, filterRows, UrlDataTableFilter } from "@/components/shared/data-table-filter";

interface RtoRecordData {
  id: string;
  warehouseId: string | null;
  receivedBy: string | null;
  rtoDocketNumber: string | null;
  rtoDate: Date | null;
}

interface DocketForm {
  id?: string;
  orderId: string;
  docketNumber: string;
}

interface DocketData {
  id: string;
  docketNumber: string | null;
  ewayBillNumber: string | null;
  podDocumentUrl: string | null;
}

interface DeliveryChallanData {
  id: string;
  dcNumber: string;
}

interface WarehouseData {
  id: string;
  name: string;
  location: string | null;
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
  status: string;
  dcNumber: string | null;
  invoiceNumber: string | null;
  assets: AssetItem[];
  dockets: DocketData[];
  deliveryChallans: DeliveryChallanData[];
  rtoRecords: RtoRecordData[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  IN_PROVISIONING:     { label: "In Provisioning",    color: "bg-purple-100 text-purple-700" },
  DOCKET_ASSIGNED:     { label: "Docket Assigned",     color: "bg-blue-100 text-blue-700" },
  DC_REQUESTED:        { label: "DC Requested",        color: "bg-indigo-100 text-indigo-700" },
  DC_GENERATED:        { label: "DC Generated",        color: "bg-indigo-100 text-indigo-700" },
  EWAY_BILL_REQUESTED: { label: "E-Way Bill Req.",     color: "bg-yellow-100 text-yellow-700" },
  EWAY_BILL_GENERATED: { label: "E-Way Bill Gen.",     color: "bg-orange-100 text-orange-700" },
  PACKED_AND_LABELLED: { label: "Packed & Labelled",   color: "bg-cyan-100 text-cyan-700" },
  DISPATCHED:          { label: "Dispatched",           color: "bg-purple-100 text-purple-700" },
  DELIVERED:                   { label: "Delivered",                    color: "bg-green-100 text-green-700" },
  RTO:                         { label: "RTO",                          color: "bg-red-100 text-red-700" },
  RTO_DC_REQUESTED:            { label: "RTO DC Requested",             color: "bg-red-200 text-red-800" },
  RTO_DC_GENERATED:            { label: "RTO DC Generated",             color: "bg-red-200 text-red-800" },
  RTO_EWAY_BILL_REQUESTED:     { label: "RTO E-Way Bill Requested",    color: "bg-red-200 text-red-800" },
  RTO_EWAY_BILL_GENERATED:     { label: "RTO E-Way Bill Generated",    color: "bg-red-200 text-red-800" },
  RTO_IN_TRANSIT:              { label: "RTO In Transit",              color: "bg-orange-100 text-orange-700" },
  RTO_DELIVERED_TO_WAREHOUSE:  { label: "RTO Delivered to Warehouse",  color: "bg-green-100 text-green-700" },
};

const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  IN_PROVISIONING:             { next: "DOCKET_ASSIGNED",               label: "Assign Docket" },
  DOCKET_ASSIGNED:             { next: "DC_REQUESTED",                  label: "Request DC" },
  DC_REQUESTED:                null,
  DC_GENERATED:                { next: "EWAY_BILL_REQUESTED",           label: "Request E-Way Bill" },
  EWAY_BILL_REQUESTED:         null,
  EWAY_BILL_GENERATED:         { next: "PACKED_AND_LABELLED",           label: "Pack & Label" },
  PACKED_AND_LABELLED:         { next: "DISPATCHED",                    label: "Dispatch" },
  DISPATCHED:                  { next: "DELIVERED",                     label: "Delivered" },
  DELIVERED:                   null,
  RTO:                         { next: "RTO_DC_REQUESTED",              label: "Request DC" },
  RTO_DC_REQUESTED:            null,
  RTO_DC_GENERATED:            { next: "RTO_EWAY_BILL_REQUESTED",       label: "Request E-Way Bill" },
  RTO_EWAY_BILL_REQUESTED:     null,
  RTO_EWAY_BILL_GENERATED:     { next: "RTO_IN_TRANSIT",                label: "Mark In Transit" },
  RTO_IN_TRANSIT:              { next: "RTO_DELIVERED_TO_WAREHOUSE",    label: "Delivered to Warehouse" },
  RTO_DELIVERED_TO_WAREHOUSE:  null,
};

interface Props {
  orders: OrderData[];
  canManage: boolean;
  warehouses: WarehouseData[];
  selectedId?: string;
}

export function LogisticsTable({ orders, canManage, warehouses, selectedId }: Props) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docketForm, setDocketForm] = useState<DocketForm | null>(null);
  const [editingDocketId, setEditingDocketId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rtoModal, setRtoModal] = useState<{ orderId: string } | null>(null);
  const [rtoForm, setRtoForm] = useState({ warehouseId: "", receivedBy: "", rtoDocketNumber: "" });
  const [podInput, setPodInput] = useState<{ docketId: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  function toggleRow(id: string) {
    setExpandedId(prev => prev === id ? null : id);
    setDocketForm(null);
    setEditingDocketId(null);
  }

  async function handleAdvance(orderId: string, targetStatus: string) {
    const info = Object.values(STATUS_FLOW).find(s => s?.next === targetStatus);
    const ok = await showAlert({
      title: `${info?.label ?? targetStatus}?`,
      description: "Move this order to the next logistics stage.",
      confirmLabel: "Yes, proceed",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await advanceOrderStatus(orderId, targetStatus);
      toast({ title: "Updated", description: `Order moved to ${STATUS_LABELS[targetStatus]?.label ?? targetStatus}.`, variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setSaving(false); }
  }

  async function handleMarkAsRto() {
    if (!rtoModal) return;
    if (!rtoForm.warehouseId || !rtoForm.receivedBy || !rtoForm.rtoDocketNumber.trim()) {
      toast({ title: "Error", description: "All fields are required.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      await markAsRto(rtoModal.orderId, rtoForm);
      toast({ title: "RTO Marked", description: "Order marked as Return to Origin.", variant: "success" });
      setRtoModal(null);
      setRtoForm({ warehouseId: "", receivedBy: "", rtoDocketNumber: "" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setSaving(false); }
  }

  function openRtoModal(orderId: string) {
    setRtoModal({ orderId });
    setRtoForm({ warehouseId: "", receivedBy: "", rtoDocketNumber: "" });
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
      await addDocket(fd);
      toast({ title: "Added", description: "Docket added.", variant: "success" });
      setDocketForm(null);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setSaving(false); }
  }

  async function handleUpdateDocket(e: React.FormEvent) {
    e.preventDefault();
    if (!docketForm || !docketForm.docketNumber.trim() || !docketForm.id) {
      toast({ title: "Error", description: "Docket number is required.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("docketNumber", docketForm.docketNumber.trim());
      await updateDocket(docketForm.id, fd);
      toast({ title: "Updated", description: "Docket updated.", variant: "success" });
      setDocketForm(null);
      setEditingDocketId(null);
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

  async function handleSavePod(docketId: string, file: File) {
    if (!file) return;
    if (!["pdf", "jpg", "jpeg", "png"].includes(file.name.split(".").pop()?.toLowerCase() ?? "")) {
      toast({ title: "Error", description: "Only PDF, JPG, and PNG files are allowed.", variant: "error" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await updateDocketPod(docketId, data.url);
      toast({ title: "POD Uploaded", description: "Proof of Delivery uploaded successfully.", variant: "success" });
      setPodInput(null);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setUploading(false); }
  }

  async function handleViewPod(filePath: string) {
    try {
      const res = await fetch(`/api/pod-url?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load POD");
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  function handleDownloadDc(dcId: string) {
    window.open(`/api/dc/${dcId}/pdf`, "_blank");
  }

  function getDcForOrder(order: OrderData) {
    return order.deliveryChallans[0] ?? null;
  }

  if (orders.length === 0) {
    return (
      <div className="p-8 rounded-xl glass text-center text-muted-foreground">
        No orders ready for logistics.
      </div>
    );
  }

  const filteredOrders = orders;

  return (<>
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <UrlDataTableFilter placeholder="Search by client, location, serial no, docket, DC..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold w-10"></th>
              <th className="px-6 py-4 font-semibold">Client</th>
              <th className="px-6 py-4 font-semibold">DC No</th>
              <th className="px-6 py-4 font-semibold">Location</th>
              <th className="px-6 py-4 font-semibold text-center">Units</th>
              <th className="px-6 py-4 font-semibold">Serial No.</th>
              <th className="px-6 py-4 font-semibold">Dockets</th>
              <th className="px-6 py-4 font-semibold">E-Way Bill</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            <ScrollToItem selectedId={selectedId} prefix="logistics" />
            {filteredOrders.map((order) => {
              const isExpanded = expandedId === order.id;
              const flowEntry = STATUS_FLOW[order.status];
              const dc = getDcForOrder(order);
              const isFormOpen = docketForm?.orderId === order.id;
              const colSpan = canManage ? 10 : 9;
              const showAddDocket = order.status === "IN_PROVISIONING" || order.status === "DOCKET_ASSIGNED";

              return (
                <Fragment key={order.id}>
                  <tr id={`logistics-${order.id}`} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4">
                      <button onClick={() => toggleRow(order.id)}
                        className="p-0.5 rounded hover:bg-muted transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-medium">{order.clientName}</td>
                    <td className="px-6 py-4">
                      {order.dcNumber ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-indigo-600">
                          {order.dcNumber}
                          {dc && (
                            <button onClick={() => handleDownloadDc(dc.id)}
                              className="p-0.5 text-muted-foreground hover:text-indigo-600 transition-colors" title="Download DC PDF">
                              <Download className="size-3.5" />
                            </button>
                          )}
                        </span>
                      ) : order.status === "DC_REQUESTED" ? (
                        <span className="text-xs text-muted-foreground italic">Awaiting Finance</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">{order.deliveryLocation}</td>
                    <td className="px-6 py-4 text-center">{order.totalQuantity}</td>
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
                    <td className="px-6 py-4">
                      {order.dockets.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {order.dockets.map(d => (
                            <span key={d.id} className="px-2 py-0.5 rounded bg-gray-50 text-gray-700 text-xs font-mono">
                              {d.docketNumber}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {order.dockets.some(d => d.ewayBillNumber) ? (
                        <div className="flex flex-wrap gap-1">
                          {order.dockets.filter(d => d.ewayBillNumber).map(d => (
                            <span key={d.id} className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-xs font-mono">
                              {d.ewayBillNumber}
                            </span>
                          ))}
                        </div>
                      ) : order.status === "EWAY_BILL_REQUESTED" ? (
                        <span className="text-xs text-muted-foreground italic">Awaiting Finance</span>
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
                          {order.status === "DISPATCHED" ? (
                            <>
                              <button onClick={() => handleAdvance(order.id, "DELIVERED")} disabled={saving}
                                className="px-2.5 py-1 rounded text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                              >
                                Delivered
                              </button>
                              <button onClick={() => openRtoModal(order.id)} disabled={saving}
                                className="px-2.5 py-1 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors whitespace-nowrap flex items-center gap-1"
                              >
                                <RotateCcw className="size-3" /> RTO
                              </button>
                            </>
                          ) : flowEntry ? (
                            <button onClick={() => handleAdvance(order.id, flowEntry.next)} disabled={saving}
                              className="px-2.5 py-1 rounded text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {flowEntry.label}
                            </button>
                          ) : order.status === "DC_REQUESTED" || order.status === "EWAY_BILL_REQUESTED" || order.status === "RTO_DC_REQUESTED" || order.status === "RTO_EWAY_BILL_REQUESTED" ? (
                            <span className="text-xs text-muted-foreground italic">Awaiting Finance</span>
                          ) : null}
                          {showAddDocket && (
                            <button onClick={() => {
                              if (isExpanded) { setExpandedId(null); setDocketForm(null); }
                              else { setExpandedId(order.id); }
                            }}
                              className="p-1 rounded hover:bg-muted transition-colors" title="Add Docket"
                            >
                              <Plus className="size-3.5 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr key={`expand-${order.id}`} className="bg-muted/10">
                      <td colSpan={colSpan} className="px-6 py-5 border-t space-y-4">
                        {/* DC Info */}
                        {dc && (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                            <FileText className="size-4 text-indigo-600" />
                            <span className="font-mono font-semibold text-sm">{dc.dcNumber}</span>
                            <button onClick={() => handleDownloadDc(dc.id)}
                              className="px-2 py-1 rounded text-xs font-medium border hover:bg-muted transition-colors flex items-center gap-1">
                              <Download className="size-3" /> Download PDF
                            </button>
                          </div>
                        )}
                        {(order.status === "DC_REQUESTED" || order.status === "RTO_DC_REQUESTED") && (
                          <p className="text-xs text-muted-foreground italic">
                            DC has been requested from Finance. Once generated, the DC number and PDF will appear here.
                          </p>
                        )}
                        {(order.status === "EWAY_BILL_REQUESTED" || order.status === "RTO_EWAY_BILL_REQUESTED") && (
                          <p className="text-xs text-muted-foreground italic">
                            E-Way bill has been requested from Finance. Once generated, it will appear here.
                          </p>
                        )}

                        {/* Dockets */}
                        {order.dockets.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dockets</p>
                            <div className="space-y-2">
                              {order.dockets.map(d => (
                                editingDocketId === d.id ? (
                                  <form key={d.id} onSubmit={handleUpdateDocket} className="flex flex-wrap gap-3 items-end p-2.5 rounded-lg bg-background border">
                                    <div>
                                      <label className="text-xs text-muted-foreground block mb-1">Docket #</label>
                                      <input value={docketForm?.docketNumber ?? ""} onChange={e => setDocketForm(prev => prev ? { ...prev, docketNumber: e.target.value } : null)}
                                        className="rounded border px-2.5 py-1.5 text-sm bg-background w-40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        placeholder="Required" />
                                    </div>
                                    <button type="submit" disabled={saving}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                    >{saving ? "Saving..." : "Save"}</button>
                                    <button type="button" onClick={() => { setEditingDocketId(null); setDocketForm(null); }}
                                      className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-muted"
                                    >Cancel</button>
                                  </form>
                                ) : (
                                  <div key={d.id} className="p-2.5 rounded-lg bg-background border">
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="text-sm">
                                        <span className="font-mono font-medium">{d.docketNumber}</span>
                                      </div>
                                      {canManage && (
                                        <div className="flex items-center gap-1">
                                          <button onClick={() => {
                                            setEditingDocketId(d.id);
                                            setDocketForm({ id: d.id, orderId: order.id, docketNumber: d.docketNumber ?? "" });
                                          }}
                                            className="p-1 rounded hover:bg-muted transition-colors" title="Edit docket"
                                          >
                                            <Edit3 className="size-3.5 text-muted-foreground" />
                                          </button>
                                          <button onClick={() => handleDeleteDocket(d.id)}
                                            className="p-1 rounded hover:bg-destructive/10 transition-colors"
                                          >
                                            <Trash2 className="size-3.5 text-destructive" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    {/* POD section */}
                                    <div className="mt-2 flex items-center gap-2">
                                      {d.podDocumentUrl ? (
                                        <button onClick={() => handleViewPod(d.podDocumentUrl!)}
                                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                                        >
                                          <Download className="size-3" /> View POD
                                        </button>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">POD not uploaded</span>
                                      )}
                                      {canManage && (order.status === "DISPATCHED" || order.status === "DELIVERED" || order.status === "RTO_DELIVERED_TO_WAREHOUSE") && (
                                        podInput?.docketId === d.id ? (
                                          <div className="flex items-center gap-2 ml-auto">
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                              onChange={e => { const f = e.target.files?.[0]; if (f) handleSavePod(d.id, f); }}
                                              className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                            {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
                                            <button type="button" onClick={() => setPodInput(null)}
                                              className="px-2 py-1 rounded text-xs font-medium border hover:bg-muted"
                                            >Cancel</button>
                                          </div>
                                        ) : (
                                          <button onClick={() => setPodInput({ docketId: d.id })}
                                            className="ml-auto px-2 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                          >
                                            {d.podDocumentUrl ? "Update POD" : "Upload POD"}
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Add Docket Form */}
                        {canManage && showAddDocket && (
                          isFormOpen ? (
                            <form onSubmit={handleAddDocket} className="flex flex-wrap gap-3 items-end">
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Docket #</label>
                                <input value={docketForm!.docketNumber} onChange={e => setDocketForm({ ...docketForm!, docketNumber: e.target.value })}
                                  className="rounded border px-2.5 py-1.5 text-sm bg-background w-40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                  placeholder="Required" />
                              </div>
                              <button type="submit" disabled={saving}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                              >{saving ? "Saving..." : "Save"}</button>
                              <button type="button" onClick={() => setDocketForm(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-muted"
                              >Cancel</button>
                            </form>
                          ) : (
                            <button onClick={() => setDocketForm({ orderId: order.id, docketNumber: "" })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border hover:bg-muted transition-colors"
                            >
                              <Plus className="size-4" /> Add Docket
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {rtoModal && createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-background rounded-xl shadow-xl border w-full max-w-lg mx-4 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mark as RTO</h2>
            <button onClick={() => { setRtoModal(null); setRtoForm({ warehouseId: "", receivedBy: "", rtoDocketNumber: "" }); }}
              className="p-1 rounded hover:bg-muted transition-colors">
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Warehouse *</label>
              <select value={rtoForm.warehouseId} onChange={e => setRtoForm({ ...rtoForm, warehouseId: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Select warehouse</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}{w.location ? ` - ${w.location}` : ""}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Received By *</label>
              <input value={rtoForm.receivedBy} onChange={e => setRtoForm({ ...rtoForm, receivedBy: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Enter name of receiver" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">RTO Docket Number *</label>
              <input value={rtoForm.rtoDocketNumber} onChange={e => setRtoForm({ ...rtoForm, rtoDocketNumber: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Enter new docket number for RTO" />
              <p className="text-xs text-muted-foreground">Old docket number will be preserved below.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">RTO Date</label>
              <input
                type="date"
                value={new Date().toISOString().split("T")[0]}
                readOnly
                disabled
                className="w-full rounded-lg border px-3 py-2 text-sm bg-muted/50 text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">Auto-filled with today's date.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setRtoModal(null); setRtoForm({ warehouseId: "", receivedBy: "", rtoDocketNumber: "" }); }}
              className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors">
              Cancel
            </button>
            <button onClick={handleMarkAsRto} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
              <RotateCcw className="size-4" /> {saving ? "Saving..." : "Mark RTO"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </>);
}
