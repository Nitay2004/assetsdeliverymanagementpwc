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
}

export function QuickStat({ icon, label, value, subtitle, iconBg, trend, href, onClick }: QuickStatProps) {
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

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  if (onClick) {
    return <button onClick={onClick} className="w-full text-left">{content}</button>;
  }

  return content;
}
