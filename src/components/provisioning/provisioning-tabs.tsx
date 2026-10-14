"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ListChecks, UserCog, Headset, Cpu, HardDrive } from "lucide-react";

type TabKey = "provisioning" | "qc" | "hp" | "reverseqc";
type ReverseQcSubTab = "hardware" | "software";

export function ProvisioningTabs({
  qcCount,
  hpCount,
  reverseQcHardwareCount,
  reverseQcSoftwareCount,
}: {
  qcCount: number;
  hpCount: number;
  reverseQcHardwareCount: number;
  reverseQcSoftwareCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: TabKey = rawTab === "qc" || rawTab === "hp" || rawTab === "reverseqc" ? rawTab : "provisioning";
  const rqcSub = searchParams.get("rqc") as ReverseQcSubTab | null;
  const activeRqcSub: ReverseQcSubTab = rqcSub === "hardware" || rqcSub === "software" ? rqcSub : "hardware";

  function go(tab: TabKey, rqc?: ReverseQcSubTab) {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page");
    p.delete("engineer");
    p.delete("selected");
    if (tab === "provisioning") {
      p.delete("tab");
      p.delete("rqc");
    } else if (tab === "qc") {
      p.set("tab", "qc");
      p.delete("rqc");
    } else if (tab === "hp") {
      p.set("tab", "hp");
      p.delete("rqc");
    } else if (tab === "reverseqc") {
      p.set("tab", "reverseqc");
      if (rqc) p.set("rqc", rqc);
    }
    const qs = p.toString();
    router.push(`/dashboard/provisioning${qs ? `?${qs}` : ""}`);
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
        <ListChecks className="size-4" />
        Provisioning
      </button>
      <button
        onClick={() => go("qc")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
          activeTab === "qc"
            ? "border-b-2 border-purple-600 text-purple-600 bg-purple-50"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        <UserCog className="size-4" />
        QC Tasks
        {qcCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-purple-600 text-white">
            {qcCount}
          </span>
        )}
      </button>
      <button
        onClick={() => go("hp")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
          activeTab === "hp"
            ? "border-b-2 border-amber-600 text-amber-700 bg-amber-50"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        <Headset className="size-4" />
        HP Cases
        {hpCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-amber-600 text-white">
            {hpCount}
          </span>
        )}
      </button>
      <div className="flex-1">
        {activeTab === "reverseqc" && (
          <div className="flex border-b border-l border-r rounded-t-lg bg-muted/30 px-2 py-1">
            <button
              onClick={() => go("reverseqc", "hardware")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${
                activeRqcSub === "hardware"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Cpu className="size-3.5" />
              Hardware QC
              {reverseQcHardwareCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold bg-primary-foreground/20 text-primary-foreground">
                  {reverseQcHardwareCount}
                </span>
              )}
            </button>
            <button
              onClick={() => go("reverseqc", "software")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${
                activeRqcSub === "software"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <HardDrive className="size-3.5" />
              Software QC
              {reverseQcSoftwareCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold bg-primary-foreground/20 text-primary-foreground">
                  {reverseQcSoftwareCount}
                </span>
              )}
            </button>
          </div>
        )}
      {activeTab === "reverseqc" ? null : (
          <button
            onClick={() => go("reverseqc", "hardware")}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <Cpu className="size-4" />
            <HardDrive className="size-4 ml-1" />
            Reverse QC
            {(reverseQcHardwareCount + reverseQcSoftwareCount) > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-cyan-600 text-white">
                {reverseQcHardwareCount + reverseQcSoftwareCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
