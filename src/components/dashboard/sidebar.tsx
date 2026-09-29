"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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
  ArrowLeftRight,
  Building2,
  Users,
  Menu,
  X,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canViewModule } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  moduleId?: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, moduleId: undefined },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package, moduleId: "inventory" },
  { href: "/dashboard/assigned-assets", label: "Assigned Assets", icon: Users, moduleId: "assigned-assets" },
  { href: "/dashboard/warehouse", label: "Warehouse", icon: Package, moduleId: "warehouse" },
  { href: "/dashboard/provisioning", label: "Provisioning", icon: Laptop, moduleId: "provisioning" },
  { href: "/dashboard/finance", label: "Finance", icon: Wallet, moduleId: "finance" },
  { href: "/dashboard/logistics", label: "Logistics", icon: Truck, moduleId: "logistics" },
  { href: "/dashboard/reverse-pickup", label: "Reverse Pickup", icon: ArrowLeftRight, moduleId: "reverse-pickup" },
  { href: "/dashboard/warranty", label: "Warranty", icon: ShieldCheck, moduleId: "warranty" },
  { href: "/dashboard/product-master", label: "Product Master", icon: Database, moduleId: "product-master" },
  { href: "/dashboard/vendor-master", label: "Vendor Master", icon: Building2, moduleId: "vendor-master" },
];

const adminNavItems: NavItem[] = [
  { href: "/dashboard/admin", label: "Admin", icon: UserCog, moduleId: "admin" },
];

function NavContent({ collapsed, onLinkClick, role, permissions }: { collapsed: boolean; onLinkClick?: () => void; role: string | null; permissions: unknown | null }) {
  const pathname = usePathname();

  const items = [
    ...navItems.filter(i => !i.moduleId || canViewModule(permissions, role, i.moduleId as any)),
    ...(role === "ADMIN" ? adminNavItems.filter(i => !i.moduleId || canViewModule(permissions, role, i.moduleId as any)) : []),
  ];

  return (
    <nav className={cn("grid gap-0.5", collapsed ? "px-2" : "px-3")}>
      {!collapsed && (
        <div className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Main Menu
        </div>
      )}

      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onLinkClick}
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
  );
}

export function Sidebar({ role, permissions }: { role: string | null; permissions: unknown | null }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile hamburger button — fixed to top-left */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden flex items-center justify-center size-10 rounded-xl bg-background border shadow-md hover:bg-muted transition-colors"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 md:hidden bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="relative flex items-center h-16 border-b border-sidebar-border">
          <div className="flex items-center gap-3 px-6 w-full">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-1 shadow shrink-0">
              <Image
                src="/devitlogo.png"
                alt="DevIT"
                width={28}
                height={28}
                className="size-6"
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-sidebar-foreground whitespace-nowrap">
              DevIT
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5">
          <NavContent collapsed={false} onLinkClick={() => setMobileOpen(false)} role={role} permissions={permissions} />
        </div>
      </aside>

      {/* Desktop sidebar */}
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-1 shadow shrink-0">
              <Image
                src="/devitlogo.png"
                alt="DevIT"
                width={28}
                height={28}
                className="size-6"
              />
            </div>
            {!collapsed && (
              <span className="text-xl font-bold tracking-tight text-sidebar-foreground whitespace-nowrap">
                DevIT
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-4 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-xl border transition-all duration-200 shadow-md hover:shadow-lg h-8 w-8 text-muted-foreground hover:text-foreground bg-background hover:bg-accent z-20"
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
          <NavContent collapsed={collapsed} role={role} permissions={permissions} />
        </div>
      </aside>
    </>
  );
}
