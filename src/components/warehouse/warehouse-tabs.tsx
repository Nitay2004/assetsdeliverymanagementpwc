"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, ClipboardCheck } from "lucide-react";

export function WarehouseTabs({ qcCount }: { qcCount: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "qc" ? "qc" : "provisioning";

  function go(tab: "provisioning" | "qc") {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page");
    p.delete("engineer");
    p.delete("selected");
    if (tab === "qc") p.set("tab", "qc");
    else p.delete("tab");
    const qs = p.toString();
    router.push(`/dashboard/warehouse${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex border-b shrink-0 rounded-lg overflow-hidden border">
      <button
        onClick={() => go("provisioning")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
          activeTab === "provisioning"
            ? "border-b-2 border-primary text-primary bg-primary/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        <Boxes className="size-4" />
        Provisioning
      </button>
      <button
        onClick={() => go("qc")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
          activeTab === "qc"
            ? "border-b-2 border-amber-500 text-amber-600 bg-amber-50"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        <ClipboardCheck className="size-4" />
        QC Assignments
        {qcCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-amber-500 text-white">
            {qcCount}
          </span>
        )}
      </button>
    </div>
  );
}
