"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, ClipboardCheck, Warehouse } from "lucide-react";

const TAB_CLASS = (active: boolean, accent: "primary" | "amber" | "blue") => {
  const activeAccent =
    accent === "amber"
      ? "border-b-2 border-amber-500 text-amber-600 bg-amber-50"
      : accent === "blue"
        ? "border-b-2 border-blue-500 text-blue-600 bg-blue-50"
        : "border-b-2 border-primary text-primary bg-primary/5";
  return `flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
    active ? activeAccent : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
  }`;
};

const BADGE_CLASS = (accent: "amber" | "blue") =>
  accent === "amber"
    ? "bg-amber-500 text-white"
    : "bg-blue-500 text-white";

export function WarehouseTabs({ qcCount, reverseCount }: { qcCount: number; reverseCount: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "qc" ? "qc" : tabParam === "reverse" ? "reverse" : "provisioning";

  function go(tab: "provisioning" | "qc" | "reverse") {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page");
    p.delete("rpage");
    p.delete("engineer");
    p.delete("selected");
    if (tab === "provisioning") p.delete("tab");
    else p.set("tab", tab);
    const qs = p.toString();
    router.push(`/dashboard/warehouse${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex border-b shrink-0 rounded-lg overflow-hidden border">
      <button onClick={() => go("provisioning")} className={TAB_CLASS(activeTab === "provisioning", "primary")}>
        <Boxes className="size-4" />
        Provisioning
      </button>
      <button onClick={() => go("qc")} className={TAB_CLASS(activeTab === "qc", "amber")}>
        <ClipboardCheck className="size-4" />
        QC Assignments
        {qcCount > 0 && (
          <span className={`ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${BADGE_CLASS("amber")}`}>
            {qcCount}
          </span>
        )}
      </button>
      <button onClick={() => go("reverse")} className={TAB_CLASS(activeTab === "reverse", "blue")}>
        <Warehouse className="size-4" />
        Reverse
        {reverseCount > 0 && (
          <span className={`ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${BADGE_CLASS("blue")}`}>
            {reverseCount}
          </span>
        )}
      </button>
    </div>
  );
}
