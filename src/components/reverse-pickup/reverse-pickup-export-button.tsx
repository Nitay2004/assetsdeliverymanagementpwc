"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function ReversePickupExportButton() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/export-reverse-pickup");
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reverse-pickup-report-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:translate-y-press disabled:opacity-50"
    >
      {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {exporting ? "Exporting..." : "Export to Excel"}
    </button>
  );
}
