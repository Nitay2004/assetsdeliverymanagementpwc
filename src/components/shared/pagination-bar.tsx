"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationBarProps {
  basePath: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

export function PaginationBar({ basePath, currentPage, totalPages, totalCount, limit }: PaginationBarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 rounded-xl glass shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page:</span>
        <select
          defaultValue={limit}
          onChange={(e) => { window.location.href = `${basePath}?page=1&limit=${e.target.value}`; }}
          className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {[10, 25, 50, 100].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span>
          {totalCount === 0 ? "0 items" : `${(currentPage - 1) * limit + 1}–${Math.min(currentPage * limit, totalCount)} of ${totalCount}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={`${basePath}?page=${currentPage - 1}&limit=${limit}`}
          className={`flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground transition-colors ${currentPage <= 1 ? "pointer-events-none opacity-30" : ""}`}
        >
          <ChevronLeft className="size-4" />
        </a>
        <span className="px-3 text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <a
          href={`${basePath}?page=${currentPage + 1}&limit=${limit}`}
          className={`flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground transition-colors ${currentPage >= totalPages ? "pointer-events-none opacity-30" : ""}`}
        >
          <ChevronRight className="size-4" />
        </a>
      </div>
    </div>
  );
}
