"use client";

import { useState } from "react";
import { Plus, Upload, Download, Loader2, Database, UserPlus, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { NewAssetModal } from "./new-asset-modal";
import { AssignUserModal } from "./assign-user-modal";

interface Props {
  isAdmin: boolean;
}

export function InventoryHeader({ isAdmin }: Props) {
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [casesExporting, setCasesExporting] = useState(false);
  const [showAssignSingle, setShowAssignSingle] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/export-inventory");
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-export-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleCasesExport() {
    setCasesExporting(true);
    try {
      const res = await fetch("/api/export-cases");
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cases-report-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setCasesExporting(false);
    }
  }

  return (
    <>
      <div className="p-3 sm:p-6 border-b bg-muted/20 border-b-black/5 dark:border-b-white/5">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-primary shrink-0" />
          <h2 className="text-lg sm:text-xl font-semibold">Inventory Pool</h2>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 sm:gap-2 rounded-lg border px-3 sm:px-4 py-2 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:translate-y-px disabled:opacity-50"
          >
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            <span className="hidden xs:inline">{exporting ? "Exporting..." : "Export"}</span>
            <span className="xs:hidden">{exporting ? "..." : "Export"}</span>
          </button>
          <button
            onClick={handleCasesExport}
            disabled={casesExporting}
            className="flex items-center gap-1.5 sm:gap-2 rounded-lg border px-3 sm:px-4 py-2 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:translate-y-px disabled:opacity-50"
          >
            {casesExporting ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
            <span className="hidden xs:inline">{casesExporting ? "Preparing..." : "Cases Report"}</span>
            <span className="xs:hidden">{casesExporting ? "..." : "Cases"}</span>
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setShowNewAsset(true)}
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-primary px-3 sm:px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">New Asset</span>
                <span className="sm:hidden">New</span>
              </button>
              <Link
                href="/dashboard/inventory/add"
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg border px-3 sm:px-4 py-2 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:translate-y-px"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Add Item</span>
                <span className="sm:hidden">Add</span>
              </Link>
              <button
                onClick={() => setShowAssignSingle(true)}
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg border px-3 sm:px-4 py-2 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:translate-y-px"
              >
                <UserPlus className="size-3.5" />
                <span className="hidden sm:inline">Assign User</span>
                <span className="sm:hidden">Assign</span>
              </button>
            </>
          )}
          <Link
            href="/dashboard/inventory/import"
            className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-primary px-3 sm:px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px"
          >
            <Upload className="size-3.5" />
            Import
          </Link>
        </div>
      </div>
      <NewAssetModal open={showNewAsset} onClose={() => setShowNewAsset(false)} />
      <AssignUserModal open={showAssignSingle} onClose={() => setShowAssignSingle(false)} mode="single" />
    </>
  );
}
