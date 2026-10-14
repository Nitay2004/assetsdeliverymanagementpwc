"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PackageCheck, Eraser } from "lucide-react";

type ReverseTab = "pipeline" | "blanco";

export function WarehouseReverseSubTabs({
  pipelineCount,
  blancoCount,
}: {
  pipelineCount: number;
  blancoCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("rtab");
  const active: ReverseTab = raw === "blanco" ? "blanco" : "pipeline";

  function go(tab: ReverseTab) {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("rpage");
    if (tab === "pipeline") p.delete("rtab");
    else p.set("rtab", tab);
    const qs = p.toString();
    router.push(`/dashboard/warehouse${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex border-b border-l border-r rounded-t-lg bg-muted/30 px-2 py-1">
      <button
        onClick={() => go("pipeline")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-t-md ${
          active === "pipeline"
            ? "bg-background text-cyan-700 border-b-2 border-cyan-600"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <PackageCheck className="size-4" />
        Receiving &amp; QC
        {pipelineCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-cyan-600 text-white">
            {pipelineCount}
          </span>
        )}
      </button>
      <button
        onClick={() => go("blanco")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-t-md ${
          active === "blanco"
            ? "bg-background text-teal-700 border-b-2 border-teal-600"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Eraser className="size-4" />
        Blanco
        {blancoCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-teal-600 text-white">
            {blancoCount}
          </span>
        )}
      </button>
    </div>
  );
}
