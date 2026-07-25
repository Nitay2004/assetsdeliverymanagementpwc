"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export default function ImportInventoryPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"upload" | "update">("upload");
  const [result, setResult] = useState<{
    success: boolean;
    imported?: number;
    updated?: number;
    mapped?: number;
    notFound?: number;
    matched?: string[];
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bulk Import Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload a CSV or Excel file to bulk-import inventory items.
          </p>
        </div>
      </div>

      <div className="rounded-xl glass shadow-sm p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Required columns:</p>
        <p>Serial Number, Employee Name, Invoicing Warehouse, Sticker Colour</p>
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

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Import Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                mode === "upload"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              <div className="text-left">
                <p className="font-semibold">Upload (New)</p>
                <p className="text-xs mt-0.5 opacity-70">Create new items, skip duplicates</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("update")}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                mode === "update"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              <div className="text-left">
                <p className="font-semibold">Update (Existing)</p>
                <p className="text-xs mt-0.5 opacity-70">Update existing items by serial no.</p>
              </div>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Importing...
            </>
          ) : (
            "Import"
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
                  <p className="font-semibold">Import Complete</p>
                  {mode === "upload" ? (
                    <p className="text-sm mt-1">{result.mapped ?? result.imported ?? 0} row(s) imported successfully.</p>
                  ) : (
                    <div className="text-sm mt-1 space-y-0.5">
                      <p>{result.updated ?? 0} item(s) updated.</p>
                      {result.notFound !== undefined && result.notFound > 0 && (
                        <p className="text-amber-600">{result.notFound} serial number(s) not found in inventory.</p>
                      )}
                    </div>
                  )}
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
