"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ProvisioningPagination({
  totalCount,
  currentPage,
  pageSize,
  extraParams,
}: {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  function buildUrl(page: number, size: number) {
    const p = new URLSearchParams(extraParams);
    p.set("page", String(page));
    p.set("limit", String(size));
    return `/dashboard/provisioning?${p.toString()}`;
  }

  function goToPage(page: number) {
    router.push(buildUrl(page, pageSize));
  }

  return (
    <div className="flex items-center justify-between px-6 py-4 rounded-xl glass shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => { router.push(buildUrl(1, Number(e.target.value))); }}
          className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {[10, 25, 50, 100].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span>
          {totalCount === 0 ? "0 items" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalCount)} of ${totalCount}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => goToPage(safePage - 1)}
          disabled={safePage <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-3 text-sm text-muted-foreground">
          Page {safePage} of {totalPages}
        </span>
        <button
          onClick={() => goToPage(safePage + 1)}
          disabled={safePage >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
