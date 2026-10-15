"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Cpu, HardDrive, Eraser } from "lucide-react";

type SubTab = "hardware" | "software" | "blanco";

export function ReverseQcSubTabs({
  hardwareCount,
  softwareCount,
  blancoCount,
}: {
  hardwareCount: number;
  softwareCount: number;
  blancoCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("rqctab");
  const active: SubTab = raw === "software" ? "software" : raw === "blanco" ? "blanco" : "hardware";

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

  const tabs: { key: SubTab; label: string; count: number; icon: typeof Cpu }[] = [
    { key: "hardware", label: "Hardware QC", count: hardwareCount, icon: Cpu },
    { key: "software", label: "Software QC", count: softwareCount, icon: HardDrive },
    { key: "blanco", label: "Blanco", count: blancoCount, icon: Eraser },
  ];

  return (
    <div className="flex border-b border-l border-r rounded-t-lg bg-muted/30 px-2 py-1">
      {tabs.map(({ key, label, count, icon: Icon }) => (
        <button
          key={key}
          onClick={() => go(key)}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${
            active === key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Icon className="size-3.5" />
          {label}
          {count > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold bg-primary-foreground/20 text-primary-foreground">
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
