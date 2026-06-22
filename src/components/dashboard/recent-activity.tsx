"use client";

import Link from "next/link";

interface Activity {
  id: string;
  message: string;
  time: string;
  module: string;
  href: string;
}

export function RecentActivity({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No recent activity.
      </p>
    );
  }

  return (
    <div className="divide-y">
      {activities.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group"
        >
          <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0 group-hover:scale-125 transition-transform" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground leading-snug">{item.message}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{item.time}</span>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-primary/70">{item.module}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
