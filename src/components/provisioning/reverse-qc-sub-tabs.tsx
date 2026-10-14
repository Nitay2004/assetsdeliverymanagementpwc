"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Cpu, HardDrive } from "lucide-react";

type SubTab = "hardware" | "software";

export function ReverseQcSubTabs({
  hardwareCount,
  softwareCount,
}: {
  hardwareCount: number;
  softwareCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("rqctab");
  const active: SubTab = raw === "software" ? "software" : "hardware";

  function go(sub: SubTab) {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page");
    p.delete("rqcpage");
    p.delete("engineer");
    p.delete("selected");
    if (sub === "hardware") p.delete("rqctab");
    else p.set("rqctab", sub);
    const qs = p.toString();
    router.push(`/dashboard/provisioning${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex border-b border-l border-r rounded-t-lg bg-muted/30 px-2 py-1">
      <button
        onClick={() => go("hardware")}
        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${
          active === "hardware"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        <Cpu className="size-3.5" />
        Hardware QC
        {hardwareCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold bg-primary-foreground/20 text-primary-foreground">
            {hardwareCount}
          </span>
        )}
      </button>
      <button
        onClick={() => go("software")}
        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${
          active === "software"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        <HardDrive className="size-3.5" />
        Software QC
        {softwareCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold bg-primary-foreground/20 text-primary-foreground">
            {softwareCount}
          </span>
        )}
      </button>
    </div>
  );
}