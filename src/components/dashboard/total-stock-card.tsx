"use client";

import { Package } from "lucide-react";
import Link from "next/link";

interface Props {
  totalInventory: number;
  stockByWarehouse: [string, number][];
  unallocatedCount: number;
  href?: string;
}

export function TotalStockCard({ totalInventory, stockByWarehouse, unallocatedCount, href }: Props) {
  const card = (
    <div className="p-5 rounded-xl glass shadow-sm flex items-start gap-4 group-hover:shadow-md transition-all duration-300 cursor-pointer">
      <div className="p-3 rounded-xl bg-blue-100 shrink-0 group-hover:scale-105 transition-transform duration-300">
        <Package className="size-5 text-blue-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Assets</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-2xl font-bold text-foreground">{totalInventory}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {stockByWarehouse.length} warehouse{stockByWarehouse.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );

  return (
    <div className="relative group">
      {href ? <Link href={href}>{card}</Link> : card}
      <div className="absolute left-0 top-full mt-2 w-72 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-1 group-hover:translate-y-0">
        <div className="rounded-xl bg-white dark:bg-zinc-900 shadow-xl border p-4 space-y-2">
          <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2">Warehouse Breakdown</p>
          {stockByWarehouse.length === 0 && unallocatedCount === totalInventory ? (
            <p className="text-sm text-muted-foreground">No items allocated yet.</p>
          ) : (
            <>
              {stockByWarehouse.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate">{name}</span>
                  <span className="font-semibold text-foreground ml-2">{count}</span>
                </div>
              ))}
              {unallocatedCount > 0 && (
                <div className="flex items-center justify-between text-sm pt-2 border-t border-border mt-2">
                  <span className="text-muted-foreground">No Warehouse</span>
                  <span className="font-semibold text-muted-foreground">{unallocatedCount}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
