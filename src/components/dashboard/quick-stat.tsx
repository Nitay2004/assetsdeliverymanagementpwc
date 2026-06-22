"use client";

interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtitle?: string;
  iconBg: string;
  trend?: { value: string; positive: boolean };
}

export function QuickStat({ icon, label, value, subtitle, iconBg, trend }: QuickStatProps) {
  return (
    <div className="p-5 rounded-xl glass shadow-sm flex items-start gap-4 group hover:shadow-md transition-all duration-300">
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
}
