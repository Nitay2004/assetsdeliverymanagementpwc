"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";

export function DateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const setParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/dashboard?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clear = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={from}
        onChange={(e) => setParams("from", e.target.value)}
        className="w-40"
      />
      <span className="text-sm text-muted-foreground">—</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => setParams("to", e.target.value)}
        className="w-40"
      />
      {(from || to) && (
        <button
          onClick={clear}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  );
}
