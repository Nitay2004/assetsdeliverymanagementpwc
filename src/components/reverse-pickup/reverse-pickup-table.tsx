"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Trash2, Eye, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { deleteReversePickupRequest } from "@/app/actions/reverse-pickup";
import { UrlDataTableFilter } from "@/components/shared/data-table-filter";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig, type ColumnFilterValue } from "@/components/shared/column-filter";

interface RequestData {
  id: string;
  requestNumber: string;
  employeeName: string;
  serialNumber: string;
  model: string;
  status: string;
  type: string | null;
  entity: string | null;
  reason: string | null;
  partnerName: string | null;
  warehouseLocation: string | null;
  courierName: string | null;
  displayStatus: string | null;
  qcResult: string | null;
  qcCleanResult: string | null;
  qcPurgeResult: string | null;
  finalDisposition: string | null;
  docketNumber: string | null;
  dcNo: string | null;
  eWayBillNo: string | null;
  blancoCertificateUrl: string | null;
  dcId: string | null;
  createdAt: string;
  pickupDate: string | null;
  [key: string]: any;
}

interface Props {
  requests: RequestData[];
  canManage: boolean;
  statusStyles: Record<string, { label: string; color: string }>;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  columnFilterValues?: Record<string, ColumnFilterValue[]>;
}

const REVERSE_PICKUP_COLUMNS: ColumnFilterConfig<RequestData>[] = [
  { key: "requestNumber", getValue: r => r.requestNumber },
  { key: "employeeName", getValue: r => r.employeeName },
  { key: "serialNumber", getValue: r => r.serialNumber },
  { key: "model", getValue: r => r.model },
  { key: "type", getValue: r => r.type },
  { key: "status", getValue: r => r.status },
  { key: "dcNo", getValue: r => r.dcNo },
  { key: "docketNumber", getValue: r => r.docketNumber },
  { key: "eWayBillNo", getValue: r => r.eWayBillNo },
  { key: "blancoCertificate", getValue: r => (r.blancoCertificateUrl ? "Has Certificate" : "") },
  { key: "partnerCourier", getValue: r => r.courierName || r.partnerName },
  { key: "createdAt", getValue: r => new Date(r.createdAt).toLocaleDateString("en-GB") },
];

export function ReversePickupTable({ requests, canManage, statusStyles, currentPage, totalPages, totalCount, limit, columnFilterValues }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { filteredRows: columnFiltered, distinctValues, filters, applyColumn, clearColumn } = useColumnFilters(REVERSE_PICKUP_COLUMNS, requests, { distinctValues: columnFilterValues });
  const displayRequests = columnFiltered;

  const handleDelete = async (id: string, requestNumber: string) => {
    const ok = await showAlert({
      title: "Delete Request",
      description: `Are you sure you want to delete request ${requestNumber}?`,
      confirmLabel: "Delete",
      variant: "warning",
    });
    if (!ok) return;

    try {
      await deleteReversePickupRequest(id);
      toast({ title: "Request deleted successfully", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({ title: "Failed to delete request", variant: "error" });
    }
  };

  const handleViewFile = async (path: string) => {
    try {
      if (/^https?:\/\//i.test(path)) {
        window.open(path, "_blank");
        return;
      }
      const res = await fetch(`/api/pod-url?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load file");
      window.open(data.url, "_blank");
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "error" });
    }
  };

  const getStatusBadge = (status: string) => {
    const style = statusStyles[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${style.color}`}>
        {style.label}
      </span>
    );
  };

  return (
    <div className="rounded-xl glass shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <UrlDataTableFilter placeholder="Search by request #, employee, serial no, model, courier..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <ColumnFilterHeader
                label="Request #"
                values={distinctValues.requestNumber ?? []}
                selected={Array.from(filters["requestNumber"] ?? [])}
                onApply={(v) => applyColumn("requestNumber", v)}
              />
              <ColumnFilterHeader
                label="Employee"
                values={distinctValues.employeeName ?? []}
                selected={Array.from(filters["employeeName"] ?? [])}
                onApply={(v) => applyColumn("employeeName", v)}
              />
              <ColumnFilterHeader
                label="Serial No."
                values={distinctValues.serialNumber ?? []}
                selected={Array.from(filters["serialNumber"] ?? [])}
                onApply={(v) => applyColumn("serialNumber", v)}
              />
              <ColumnFilterHeader
                label="Model"
                values={distinctValues.model ?? []}
                selected={Array.from(filters["model"] ?? [])}
                onApply={(v) => applyColumn("model", v)}
              />
              <ColumnFilterHeader
                label="Type"
                values={distinctValues.type ?? []}
                selected={Array.from(filters["type"] ?? [])}
                onApply={(v) => applyColumn("type", v)}
              />
              <ColumnFilterHeader
                label="Status"
                values={distinctValues.status ?? []}
                selected={Array.from(filters["status"] ?? [])}
                onApply={(v) => applyColumn("status", v)}
              />
              <ColumnFilterHeader
                label="DC"
                values={distinctValues.dcNo ?? []}
                selected={Array.from(filters["dcNo"] ?? [])}
                onApply={(v) => applyColumn("dcNo", v)}
              />
              <ColumnFilterHeader
                label="Docket"
                values={distinctValues.docketNumber ?? []}
                selected={Array.from(filters["docketNumber"] ?? [])}
                onApply={(v) => applyColumn("docketNumber", v)}
              />
              <ColumnFilterHeader
                label="E-Way Bill"
                values={distinctValues.eWayBillNo ?? []}
                selected={Array.from(filters["eWayBillNo"] ?? [])}
                onApply={(v) => applyColumn("eWayBillNo", v)}
              />
              <ColumnFilterHeader
                label="Blanco Cert"
                values={distinctValues.blancoCertificate ?? []}
                selected={Array.from(filters["blancoCertificate"] ?? [])}
                onApply={(v) => applyColumn("blancoCertificate", v)}
              />
              <ColumnFilterHeader
                label="Partner/Courier"
                values={distinctValues.partnerCourier ?? []}
                selected={Array.from(filters["partnerCourier"] ?? [])}
                onApply={(v) => applyColumn("partnerCourier", v)}
              />
              <ColumnFilterHeader
                label="Created"
                values={distinctValues.createdAt ?? []}
                selected={Array.from(filters["createdAt"] ?? [])}
                onApply={(v) => applyColumn("createdAt", v)}
              />
              {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayRequests.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 13 : 12} className="px-6 py-12 text-center text-muted-foreground">
                  {requests.length === 0 ? "No reverse pickup requests found." : "No rows match the selected filters."}
                </td>
              </tr>
            ) : (
              displayRequests.map((req) => (
                <Fragment key={req.id}>
                  <tr
                    className="hover:bg-muted/10 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {expandedId === req.id ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                        <span className="font-mono font-medium text-primary">{req.requestNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{req.employeeName}</td>
                    <td className="px-6 py-4 font-mono text-xs">{req.serialNumber}</td>
                    <td className="px-6 py-4 text-muted-foreground">{req.model}</td>
                    <td className="px-6 py-4 text-muted-foreground">{req.type || "—"}</td>
                    <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                    <td className="px-6 py-4">
                      {req.dcNo ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-mono">
                          {req.dcNo}
                          {req.dcId && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); window.open(`/api/dc/${req.dcId}/pdf`, "_blank"); }}
                              className="p-0.5 text-muted-foreground hover:text-indigo-600 transition-colors"
                              title="Download DC PDF"
                            >
                              <Download className="size-3.5" />
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {req.docketNumber ? (
                        <span className="px-2 py-0.5 rounded bg-gray-50 text-gray-700 text-xs font-mono">
                          {req.docketNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {req.eWayBillNo ? (
                        <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-xs font-mono">
                          {req.eWayBillNo}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {req.blancoCertificateUrl ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (req.blancoCertificateUrl) handleViewFile(req.blancoCertificateUrl); }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-xs font-semibold hover:underline"
                        >
                          <FileText className="size-3" />
                          View
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {req.courierName || req.partnerName || "—"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(req.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/reverse-pickup/${req.id}`}
                            className="p-1.5 rounded-lg hover:bg-muted/20 transition-colors"
                            title="View Details"
                          >
                            <Eye className="size-4 text-muted-foreground" />
                          </Link>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(req.id, req.requestNumber); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-4 text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {expandedId === req.id && (
                    <tr className="bg-muted/5">
                      <td colSpan={canManage ? 13 : 12} className="px-6 py-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Contact</p>
                            <p className="font-medium">{req.emailId || "—"}</p>
                            <p className="text-muted-foreground">{req.mobileNumber || "—"}</p>
                            {req.entity && <p className="text-muted-foreground mt-1">Entity: {req.entity}</p>}
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Pickup Address</p>
                            <p className="text-muted-foreground">{req.pickupAddress}</p>
                            {req.city && <p className="text-muted-foreground">{req.city}, {req.state} {req.pinCode}</p>}
                            {req.reason && <p className="text-muted-foreground mt-1">Reason: {req.reason}</p>}
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Warehouse</p>
                            <p className="font-medium">{req.warehouseLocation || "—"}</p>
                            {req.displayStatus && <p className="text-muted-foreground">Status: {req.displayStatus}</p>}
                            {(req.qcCleanResult || req.qcPurgeResult) && (
                              <p className="text-xs font-semibold uppercase text-muted-foreground mt-2 mb-1">QC</p>
                            )}
                            {req.qcCleanResult && (
                              <p className="text-muted-foreground text-xs">
                                Clean: <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  req.qcCleanResult === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}>{req.qcCleanResult}</span>
                              </p>
                            )}
                            {req.qcPurgeResult && (
                              <p className="text-muted-foreground text-xs">
                                Purge: <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  req.qcPurgeResult === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}>{req.qcPurgeResult}</span>
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Disposition</p>
                            <p className="font-medium">{req.finalDisposition || "—"}</p>
                            <Link
                              href={`/dashboard/reverse-pickup/${req.id}`}
                              className="inline-flex items-center gap-1 mt-2 text-primary text-xs font-semibold hover:underline"
                            >
                              Manage <ExternalLink className="size-3" />
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      <PaginationBar
        basePath="/dashboard/reverse-pickup"
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
      />
    </div>
  );
}
