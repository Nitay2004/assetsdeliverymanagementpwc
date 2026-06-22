"use client";

interface OrdersByStatusProps {
  data: { status: string; count: number; color: string }[];
  total: number;
}

export function OrderPipeline({ data, total }: OrdersByStatusProps) {
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.status} className="flex items-center gap-3">
          <div className="w-28 text-xs font-medium text-muted-foreground truncate" title={item.status}>
            {item.status}
          </div>
          <div className="flex-1 h-3 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span className="w-8 text-right text-sm font-bold text-foreground">{item.count}</span>
        </div>
      ))}
    </div>
  );
}
