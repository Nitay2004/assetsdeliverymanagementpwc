"use client";

import { useEffect } from "react";

export function ScrollToItem({ selectedId, prefix = "item" }: { selectedId?: string; prefix?: string }) {
  useEffect(() => {
    if (!selectedId) return;
    const el = document.getElementById(`${prefix}-${selectedId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/40", "rounded-xl", "transition-all", "duration-700");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/40");
      }, 2000);
    }
  }, [selectedId, prefix]);

  return null;
}
