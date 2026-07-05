"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { deleteReversePickupRequest } from "@/app/actions/reverse-pickup";

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
  finalDisposition: string | null;
  createdAt: string;
  pickupDate: string | null;
  [key: string]: any;
}

interface Props {
  requests: RequestData[];
  canManage: boolean;
  statusStyles: Record<string, { label: string; color: string }>;
}

export function ReversePickupTable({ requests, canManage, statusStyles }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold">Request #</th>
              <th className="px-6 py-4 font-semibold">Employee</th>
              <th className="px-6 py-4 font-semibold">Serial No.</th>
              <th className="px-6 py-4 font-semibold">Model</th>
              <th className="px-6 py-4 font-semibold">Type</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Partner/Courier</th>
              <th className="px-6 py-4 font-semibold">Created</th>
              {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-6 py-12 text-center text-muted-foreground">
                  No reverse pickup requests yet.
                </td>
              </tr>
            ) : (
              requests.map((req) => (
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
                      <td colSpan={canManage ? 9 : 8} className="px-6 py-6">
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
                            {req.qcResult && (
                              <>
                                <p className="text-xs font-semibold uppercase text-muted-foreground mt-2 mb-1">QC Result</p>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  req.qcResult === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}>{req.qcResult}</span>
                              </>
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
    </div>
  );
}
