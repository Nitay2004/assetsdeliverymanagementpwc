"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, RotateCcw } from "lucide-react";

/**
 * Top-level Forward / Reverse switch for the finance and logistics modules.
 *
 * Mirrors ProvisioningTabs: Forward is the default and carries no `tab` param,
 * so plain links (and PaginationBar, which rebuilds the query string) land on
 * Forward instead of silently keeping a stale tab.
 */
export function ForwardReverseTabs({ reverseCount }: { reverseCount?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReverse = searchParams.get("tab") === "reverse";

  function go(toReverse: boolean) {
    if (toReverse === isReverse) return;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page");
    p.delete("selected");
    if (toReverse) p.set("tab", "reverse");
    else p.delete("tab");
    const qs = p.toString();
    router.push(`${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex border-b shrink-0 rounded-lg overflow-hidden border">
      <button
        onClick={() => go(false)}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
          !isReverse
            ? "border-b-2 border-primary text-primary bg-primary/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        <ArrowRight className="size-4" />
        Forward
      </button>
      <button
        onClick={() => go(true)}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
          isReverse
            ? "border-b-2 border-orange-600 text-orange-700 bg-orange-50"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        <RotateCcw className="size-4" />
        Reverse
        {typeof reverseCount === "number" && reverseCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-orange-600 text-white">
            {reverseCount}
          </span>
        )}
      </button>
    </div>
  );
}
