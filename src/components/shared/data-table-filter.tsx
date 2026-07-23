"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DataTableFilter({ value, onChange, placeholder = "Search across all fields...", className }: Props) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-background pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors"
        >
          <X className="size-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

export function UrlDataTableFilter({ placeholder = "Search across all fields...", className }: { placeholder?: string; className?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentSearch = searchParams.get("search") ?? "";

  const [localValue, setLocalValue] = useState(currentSearch);

  useEffect(() => {
    setLocalValue(currentSearch);
  }, [currentSearch]);

  const debounceRef = useCallback(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (val: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (val.trim()) {
          params.set("search", val.trim());
        } else {
          params.delete("search");
        }
        params.delete("page");
        router.push(`${pathname}?${params.toString()}`);
      }, 400);
    };
  }, [searchParams, router, pathname])();

  function handleChange(val: string) {
    setLocalValue(val);
    debounceRef(val);
  }

  function handleClear() {
    setLocalValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={localValue}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-background pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors"
        >
          <X className="size-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

export function filterRows<T>(rows: T[], query: string, fields: (keyof T)[]): T[] {
  if (!query.trim()) return rows;
  const q = query.toLowerCase().trim();
  return rows.filter(row =>
    fields.some(field => {
      const val = row[field];
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(q);
    })
  );
}
