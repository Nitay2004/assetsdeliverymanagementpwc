"use client";

import Link from "next/link";

interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtitle?: string;
  iconBg: string;
  trend?: { value: string; positive: boolean };
  href?: string;
  onClick?: () => void;
  /**
   * Optional warehouse-wise breakdown, shown on hover exactly like the
   * "Total Assets" card. Entries are [warehouseName, count].
   */
  breakdown?: [string, number][];
  /** Items with no invoicing warehouse, shown as a trailing "No Warehouse" row. */
  breakdownNoWarehouse?: number;
}

export function QuickStat({
  icon,
  label,
  value,
  subtitle,
  iconBg,
  trend,
  href,
  onClick,
  breakdown,
  breakdownNoWarehouse = 0,
}: QuickStatProps) {
  const content = (
    <div className="p-5 rounded-xl glass shadow-sm flex items-start gap-4 group hover:shadow-md transition-all duration-300 cursor-pointer">
      <div className={`p-3 rounded-xl ${iconBg} shrink-0 group-hover:scale-105 transition-transform duration-300`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">{label}</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {trend && (
            <span className={`text-xs font-semibold pb-0.5 ${trend.positive ? "text-green-600" : "text-red-500"}`}>
              {trend.positive ? "↑" : "↓"} {trend.value}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );

  const trigger = href ? (
    <Link href={href} className="block">{content}</Link>
  ) : onClick ? (
    <button onClick={onClick} className="w-full text-left">{content}</button>
  ) : (
    content
  );

  if (!breakdown) {
    return trigger;
  }

  return (
    <div className="relative group/stat">
      {trigger}
      <div className="absolute left-0 top-full mt-2 w-72 z-50 opacity-0 invisible group-hover/stat:opacity-100 group-hover/stat:visible transition-all duration-200 translate-y-1 group-hover/stat:translate-y-0">
        <div className="rounded-xl bg-white dark:bg-zinc-900 shadow-xl border p-4 space-y-2">
          <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2">Warehouse Breakdown</p>
          {breakdown.length === 0 && breakdownNoWarehouse === 0 ? (
            <p className="text-sm text-muted-foreground">No items in this bucket.</p>
          ) : (
            <>
              {breakdown.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate">{name}</span>
                  <span className="font-semibold text-foreground ml-2">{count}</span>
                </div>
              ))}
              {breakdownNoWarehouse > 0 && (
                <div className="flex items-center justify-between text-sm pt-2 border-t border-border mt-2">
                  <span className="text-muted-foreground">No Warehouse</span>
                  <span className="font-semibold text-muted-foreground">{breakdownNoWarehouse}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
