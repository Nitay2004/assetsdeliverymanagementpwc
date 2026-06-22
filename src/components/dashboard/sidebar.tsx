"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package,
  Truck,
  Laptop,
  Wallet,
  ShieldCheck,
  LayoutDashboard,
  PanelLeftClose,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/warehouse", label: "Warehouse", icon: Package },
  { href: "/dashboard/provisioning", label: "Provisioning", icon: Laptop },
  { href: "/dashboard/finance", label: "Finance", icon: Wallet },
  { href: "/dashboard/logistics", label: "Logistics", icon: Truck },
  { href: "/dashboard/warranty", label: "Warranty", icon: ShieldCheck },
  { href: "/dashboard/product-master", label: "Product Master", icon: Database },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "bg-sidebar border-r border-sidebar-border flex-col hidden md:flex min-h-screen transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="relative flex items-center h-16 border-b border-sidebar-border">
        <div
          className={cn(
            "flex items-center gap-3 w-full",
            collapsed ? "justify-center" : "px-6"
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow shrink-0">
            <Package className="size-5" />
          </div>
          {!collapsed && (
            <span className="text-xl font-bold tracking-tight text-sidebar-foreground whitespace-nowrap">
              Devit
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-4 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-xl border transition-all duration-200 shadow-md hover:shadow-lg h-8 w-8 text-muted-foreground hover:text-foreground bg-background hover:bg-accent"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeftClose
            className={cn(
              "size-4 transition-transform duration-300",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-5">
        <nav className={cn("grid gap-0.5", collapsed ? "px-2" : "px-3")}>
          {!collapsed && (
            <div className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Main Menu
            </div>
          )}

          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center" : "px-4",
                  isActive
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:text-sidebar-accent-foreground",
                )}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-xl bg-sidebar-accent shadow-lg shadow-black/10" />
                )}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary" />
                )}
                {!isActive && (
                  <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 bg-sidebar-accent/50 transition-opacity duration-200" />
                )}
                <Icon className="relative size-4 shrink-0" />
                {!collapsed && (
                  <span className="relative font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
