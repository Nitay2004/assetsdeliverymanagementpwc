"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2, FileText, Download } from "lucide-react";
import { useRouter } from "next/navigation";
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
}

export function ReversePickupFinanceSection({ dcRequests, ewayRequests, canManage, dcIdMap }: Props) {
  const { toast } = useToast();
  const router = useRouter();
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

  if (dcRequests.length === 0 && ewayRequests.length === 0) return null;

  return (
    <>
      <div className="rounded-xl glass shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-orange-50 flex items-center gap-2">
          <ArrowUpRight className="size-4 text-orange-600" />
          <h2 className="text-sm font-semibold text-orange-800">Reverse Pickup — Finance Actions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40">
              <tr>
                <th className="px-6 py-4 font-semibold">Request #</th>
                <th className="px-6 py-4 font-semibold">Serial #</th>
                <th className="px-6 py-4 font-semibold">Model</th>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">DC No</th>
                <th className="px-6 py-4 font-semibold">E-Way Bill</th>
                {canManage && <th className="px-6 py-4 font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* DC Requests */}
              {dcRequests.map(r => (
                <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600">{r.requestNumber}</td>
                  <td className="px-6 py-4 font-mono text-xs">{r.serialNumber}</td>
                  <td className="px-6 py-4">{r.model}</td>
                  <td className="px-6 py-4">{r.employeeName}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      DC Requested
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{r.dcNo || <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="px-6 py-4 font-mono text-xs">{r.eWayBillNo || <span className="text-muted-foreground italic">—</span>}</td>
                  {canManage && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setDcModalId(r.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      >
                        <FileText className="size-3" />
                        Generate DC
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {/* E-Way Bill Requests */}
              {ewayRequests.map(r => (
                <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600">{r.requestNumber}</td>
                  <td className="px-6 py-4 font-mono text-xs">{r.serialNumber}</td>
                  <td className="px-6 py-4">{r.model}</td>
                  <td className="px-6 py-4">{r.employeeName}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                      E-Way Bill Req.
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
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dcModalId && (
        <ReversePickupDcModal
          rpId={dcModalId}
          open={!!dcModalId}
          onClose={() => setDcModalId(null)}
        />
      )}
    </>
  );
}