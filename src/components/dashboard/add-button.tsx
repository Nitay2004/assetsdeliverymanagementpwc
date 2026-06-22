"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Package, ShoppingCart } from "lucide-react";
import Link from "next/link";

const addItems = [
  { href: "/dashboard/inventory/add", label: "Inventory Item", icon: Package },
  { href: "/dashboard/warehouse/add", label: "Order", icon: ShoppingCart },
];

export function AddButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-press"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">Add</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl glass p-1.5 shadow-xl animate-in fade-in slide-in-from-top-2">
          {addItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <item.icon className="size-4 shrink-0 text-muted-foreground" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
