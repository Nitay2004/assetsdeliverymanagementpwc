"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2, FileText, Download } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { generateReversePickupEwayBill } from "@/app/actions/reverse-pickup";
import { ReversePickupDcModal } from "@/components/finance/reverse-pickup-dc-modal";

interface RpRequest {
  id: string;
  requestNumber: string;
  serialNumber: string;
  model: string;
  employeeName: string;
  status: string;
  dcNo: string | null;
  eWayBillNo: string | null;
  eWayBillDocumentUrl: string | null;
}

interface Props {
  dcRequests: RpRequest[];
  ewayRequests: RpRequest[];
  canManage: boolean;
  dcIdMap: Map<string, string>;
  reverseSubTab?: string;
}

const HEADERS = ["Request #", "Serial #", "Model", "Employee", "Status", "DC No", "E-Way Bill", "Action"];

export function ReversePickupFinanceSection({ dcRequests, ewayRequests, canManage, dcIdMap, reverseSubTab = "dc" }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState<string | null>(null);
  const [dcModalId, setDcModalId] = useState<string | null>(null);
  const [ewayInputs, setEwayInputs] = useState<Record<string, string>>({});
  const [ewayFiles, setEwayFiles] = useState<Record<string, File>>({});

  async function handleViewFile(path: string) {
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
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "error" });
    }
  }

  async function handleGenerateEway(requestId: string) {
    const eWayBillNo = ewayInputs[requestId];
    if (!eWayBillNo?.trim()) {
      toast({ title: "Error", description: "E-Way bill number is required.", variant: "error" });
      return;
    }
    const file = ewayFiles[requestId];
    setSaving(requestId);
    try {
      let attachmentUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
          toast({ title: "Error", description: "Only PDF, JPG, JPEG and PNG files are allowed.", variant: "error" });
          return;
        }
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        attachmentUrl = data.url;
      }
      const fd = new FormData();
      fd.set("id", requestId);
      fd.set("eWayBillNo", eWayBillNo.trim());
      if (attachmentUrl) fd.set("eWayBillDocumentUrl", attachmentUrl);
      await generateReversePickupEwayBill(fd);
      toast({ title: "E-Way Bill Generated", description: "Reverse pickup E-Way bill has been generated.", variant: "success" });
      setEwayInputs(prev => { const n = { ...prev }; delete n[requestId]; return n; });
      setEwayFiles(prev => { const n = { ...prev }; delete n[requestId]; return n; });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally { setSaving(null); }
  }

  const requestsToShow = reverseSubTab === "eway" ? ewayRequests : dcRequests;
  const emptyMessage = reverseSubTab === "eway" ? "No E-Way Bill requests to process." : "No DC requests to process.";

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("rtab", "dc");
            params.delete("page");
            router.push(`${window.location.pathname}?${params.toString()}`);
          }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${reverseSubTab === "dc" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          DC
        </button>
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("rtab", "eway");
            params.delete("page");
            router.push(`${window.location.pathname}?${params.toString()}`);
          }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${reverseSubTab === "eway" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          E-Way Bill
        </button>
      </div>

      {requestsToShow.length === 0 ? (
        <div className="p-8 rounded-xl glass text-center text-muted-foreground">
          {emptyMessage}
        </div>
      ) : reverseSubTab === "dc" ? (
        <div className="rounded-xl glass shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-orange-50 flex items-center gap-2">
            <ArrowUpRight className="size-4 text-orange-600" />
            <h2 className="text-sm font-semibold text-orange-800">Reverse Pickup - DC</h2>
            <span className="ml-auto text-xs text-orange-600 font-medium">{dcRequests.length} cases</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40">
                <tr>
                  {HEADERS.map(h => (
                    <th key={h} className="px-6 py-4 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {dcRequests.map(r => {
                  const dcDone = r.status === "DC_GENERATED";
                  return (
                  <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600">{r.requestNumber}</td>
                    <td className="px-6 py-4 font-mono text-xs">{r.serialNumber}</td>
                    <td className="px-6 py-4">{r.model}</td>
                    <td className="px-6 py-4">{r.employeeName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${dcDone ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                        {dcDone ? "DC Generated" : "DC Requested"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {r.dcNo ? (
                        <span className="inline-flex items-center gap-1">
                          {r.dcNo}
                          {dcIdMap.get(r.id) && (
                            <a href={`/api/dc/${dcIdMap.get(r.id)}/pdf`} target="_blank" className="text-primary font-semibold hover:underline ml-1">View</a>
                          )}
                        </span>
                      ) : <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{r.eWayBillNo || <span className="text-muted-foreground italic">—</span>}</td>
                    {canManage && (
                      <td className="px-6 py-4">
                        {dcDone ? (
                          <span className="text-xs text-muted-foreground">No action needed</span>
                        ) : (
                          <button
                            onClick={() => setDcModalId(r.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                          >
                            <FileText className="size-3" />
                            Generate DC
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl glass shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-orange-50 flex items-center gap-2">
            <ArrowUpRight className="size-4 text-orange-600" />
            <h2 className="text-sm font-semibold text-orange-800">Reverse Pickup - E-Way Bill</h2>
            <span className="ml-auto text-xs text-orange-600 font-medium">{ewayRequests.length} cases</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40">
                <tr>
                  {HEADERS.map(h => (
                    <th key={h} className="px-6 py-4 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {ewayRequests.map(r => {
                  const ewayDone = r.status === "EWAY_BILL_GENERATED";
                  return (
                  <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600">{r.requestNumber}</td>
                    <td className="px-6 py-4 font-mono text-xs">{r.serialNumber}</td>
                    <td className="px-6 py-4">{r.model}</td>
                    <td className="px-6 py-4">{r.employeeName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ewayDone ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {ewayDone ? "E-Way Generated" : "E-Way Bill Req."}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {r.dcNo ? (
                        <span className="inline-flex items-center gap-1">
                          {r.dcNo}
                          {dcIdMap.get(r.id) && (
                            <a href={`/api/dc/${dcIdMap.get(r.id)}/pdf`} target="_blank" className="text-primary font-semibold hover:underline ml-1">View</a>
                          )}
                        </span>
                      ) : <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {r.eWayBillNo ? (
                        <span className="inline-flex items-center gap-1">
                          {r.eWayBillNo}
                          {r.eWayBillDocumentUrl && (
                            <button
                              type="button"
                              onClick={() => { if (r.eWayBillDocumentUrl) handleViewFile(r.eWayBillDocumentUrl); }}
                              className="p-0.5 text-muted-foreground hover:text-orange-600 transition-colors"
                              title="View E-Way Bill attachment"
                            >
                              <Download className="size-3.5" />
                            </button>
                          )}
                        </span>
                      ) : <span className="text-muted-foreground italic">—</span>}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4">
                        {ewayDone ? (
                          <span className="text-xs text-muted-foreground">No action needed</span>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <input
                                value={ewayInputs[r.id] ?? ""}
                                onChange={e => setEwayInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                                className="w-28 rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                placeholder="E-Way #"
                              />
                              <button
                                onClick={() => handleGenerateEway(r.id)}
                                disabled={saving === r.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                              >
                                {saving === r.id ? <Loader2 className="size-3 animate-spin" /> : null}
                                {saving === r.id ? "Saving..." : "Generate"}
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={e => { const f = e.target.files?.[0] ?? null; if (f) setEwayFiles(prev => ({ ...prev, [r.id]: f })); }}
                                className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                              />
                              {ewayFiles[r.id] && <span className="text-xs text-muted-foreground truncate max-w-[100px]">{ewayFiles[r.id].name}</span>}
                            </div>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dcModalId && (
        <ReversePickupDcModal
          rpId={dcModalId}
          open={!!dcModalId}
          onClose={() => setDcModalId(null)}
        />
      )}
    </div>
  );
}
