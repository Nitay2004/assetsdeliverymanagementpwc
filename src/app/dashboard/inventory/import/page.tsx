"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, AlertCircle, CheckCircle2, Loader2, Database, RefreshCw } from "lucide-react";

type Mode = "upload" | "update";

export default function ImportInventoryPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("upload");
  const [result, setResult] = useState<{
    success: boolean;
    mapped?: number;
    updated?: number;
    notFound?: number;
    errors?: string[] | null;
    warning?: string | null;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="max-w-xl mx-auto space-y-6">
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
          onClick={() => { setMode("upload"); setResult(null); }}
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
          onClick={() => { setMode("update"); setResult(null); }}
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
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      </form>

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
