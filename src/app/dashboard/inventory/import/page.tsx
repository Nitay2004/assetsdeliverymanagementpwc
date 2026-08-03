"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, AlertCircle, CheckCircle2, Loader2, Database, RefreshCw, FileSearch, XCircle, Check } from "lucide-react";

type Mode = "upload" | "update";

interface MappingRow {
  header: string;
  field: string | null;
  sample: string;
}

interface Preview {
  rowCount: number;
  mapping: MappingRow[];
  unknown: string[];
  sheets?: { name: string; headerCount: number; rowCount: number }[];
}

export default function ImportInventoryPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("upload");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    mapped?: number;
    updated?: number;
    notFound?: number;
    errors?: string[] | null;
    warning?: string | null;
    matched?: { header: string; field: string }[];
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function runPreview() {
    if (!file) return;
    setVerifying(true);
    setResult(null);
    setPreview(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", "preview");
    try {
      const res = await fetch("/api/import-csv", { method: "POST", body: fd });
      const data = await res.json();
      if (data.preview) setPreview(data);
      else setResult(data);
    } catch {
      setResult({ success: false, error: "Network error. Please try again." });
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);

    try {
      const res = await fetch("/api/import-csv", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  const unknownCount = preview?.unknown.length ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory"
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mode === "upload" ? "Bulk Import Inventory" : "Update Existing Inventory"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {mode === "upload"
              ? "Upload a CSV or Excel file to bulk-import inventory items."
              : "Upload a CSV or Excel file to update existing inventory items by serial number."}
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="rounded-xl glass shadow-sm p-1 flex gap-1">
        <button
          type="button"
          onClick={() => { setMode("upload"); setResult(null); setPreview(null); }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
            mode === "upload"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Upload className="size-4" />
          Upload New
        </button>
        <button
          type="button"
          onClick={() => { setMode("update"); setResult(null); setPreview(null); }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
            mode === "update"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <RefreshCw className="size-4" />
          Update Existing
        </button>
      </div>

      {/* Mode Description */}
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {mode === "upload" ? (
          <div className="flex items-start gap-3">
            <Database className="size-5 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Create new inventory items</p>
              <p className="mt-1">Items with new serial numbers will be created. Existing serial numbers will get a new assignment record.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <RefreshCw className="size-5 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Update existing inventory items</p>
              <p className="mt-1">Serial numbers in your sheet will be matched against existing inventory. The current assignment will be saved to history, and the item will be updated with new data from the sheet.</p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl glass shadow-sm p-6 space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            CSV / Excel File
          </label>
          <div
            className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {file ? file.name : "Click to select a file"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                CSV or Excel file with headers matching inventory columns
              </p>
            </div>
          </div>
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setResult(null); }}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={runPreview}
            disabled={!file || verifying}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {verifying ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}
            {verifying ? "Checking..." : "Verify Column Mapping"}
          </button>
          <button
            type="submit"
            disabled={!file || loading || !preview}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {mode === "upload" ? "Importing..." : "Updating..."}
              </>
            ) : (
              mode === "upload" ? "Import" : "Update Inventory"
            )}
          </button>
        </div>
        {!preview && !loading && (
          <p className="text-xs text-muted-foreground text-center">
            Click &ldquo;Verify Column Mapping&rdquo; first to confirm every column is mapped correctly before importing.
          </p>
        )}
      </form>

      {preview && (
        <div className="rounded-xl glass shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSearch className="size-5 text-primary" />
              <div>
                <h2 className="font-semibold">Column Mapping Preview</h2>
                <p className="text-sm text-muted-foreground">
                  {preview.rowCount} data row(s) detected in first sheet
                  {preview.sheets && preview.sheets.length > 1
                    ? ` · ${preview.sheets.length} sheets total (${preview.sheets.map(s => `${s.name}: ${s.rowCount}`).join(", ")})`
                    : ""}
                  {" "}· Sample value shown from the first row
                </p>
              </div>
            </div>
            {unknownCount > 0 ? (
              <span className="flex items-center gap-1.5 rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold">
                <XCircle className="size-3.5" />
                {unknownCount} unrecognized
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-semibold">
                <Check className="size-3.5" />
                All columns mapped
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">#</th>
                  <th className="px-4 py-2.5 font-semibold">Column Header</th>
                  <th className="px-4 py-2.5 font-semibold">Mapped To</th>
                  <th className="px-4 py-2.5 font-semibold">Sample Value</th>
                </tr>
              </thead>
              <tbody>
                {preview.mapping.map((m, i) => (
                  <tr key={i} className={`border-t ${m.field ? "" : "bg-red-50/60"}`}>
                    <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-medium">{m.header || <span className="text-muted-foreground italic">(empty header)</span>}</td>
                    <td className="px-4 py-2">
                      {m.field ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 text-green-700 px-2 py-0.5 text-xs font-semibold">
                          <Check className="size-3" />
                          {m.field}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 text-red-700 px-2 py-0.5 text-xs font-semibold">
                          <XCircle className="size-3" />
                          Will be ignored
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">{m.sample || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {unknownCount > 0 && (
            <div className="flex items-start gap-3 text-red-600 text-sm">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {unknownCount} column(s) won&apos;t be imported — data in these columns WILL BE LOST.
                </p>
                <p className="mt-1">
                  Rename these headers in your file to match known inventory fields, or add them to the import mapping, then verify again.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="rounded-xl glass shadow-sm p-6 space-y-3">
          {result.error && (
            <div className="flex items-start gap-3 text-destructive">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Import Failed</p>
                <p className="text-sm mt-1">{result.error}</p>
              </div>
            </div>
          )}

          {result.success && (
            <>
              <div className="flex items-start gap-3 text-green-600">
                <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {mode === "upload" ? "Import Complete" : "Update Complete"}
                  </p>
                  <div className="text-sm mt-1 space-y-0.5">
                    {mode === "upload" ? (
                      <p>{result.mapped} record(s) imported with assignment history.</p>
                    ) : (
                      <>
                        <p>{result.updated ?? 0} item(s) updated successfully.</p>
                        {result.mapped ? <p>{result.mapped} new assignment record(s) saved to history.</p> : null}
                        {result.notFound ? <p className="text-amber-600">{result.notFound} serial number(s) not found in inventory.</p> : null}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {result.warning && (
                <div className="flex items-start gap-3 text-amber-600">
                  <AlertCircle className="size-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{result.warning}</p>
                </div>
              )}

              {result.matched && result.matched.length > 0 && (
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Column Mapping Used</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.matched.map((m, i) => (
                      <span key={i} className="rounded-md bg-muted px-2 py-1 text-xs">
                        <span className="font-medium">{m.header}</span> <span className="text-muted-foreground">→</span> <span className="font-medium text-green-700">{m.field}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="flex items-start gap-3 text-amber-600">
                  <AlertCircle className="size-5 shrink-0 mt-0.5" />
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">{result.errors.length} row(s) had issues:</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <button
                onClick={() => router.push("/dashboard/inventory")}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px"
              >
                View Inventory
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
