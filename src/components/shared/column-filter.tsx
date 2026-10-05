"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Check, ChevronDown, Search } from "lucide-react";

export interface ColumnFilterConfig<T> {
  key: string;
  getValue: (row: T) => string | number | null | undefined;
}

export function cellValueToLabel(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "(Blank)";
  const s = String(value);
  return s.trim() === "" ? "(Blank)" : s;
}

export interface ColumnFilterValue {
  value: string;
  count: number;
}

interface UseColumnFiltersOptions {
  distinctValues?: Record<string, ColumnFilterValue[]>;
}

type FilterMap = Record<string, string[]>;

function parseFilters<T>(config: ColumnFilterConfig<T>[], sp: URLSearchParams): FilterMap {
  const out: FilterMap = {};
  for (const col of config) {
    const raw = sp.get(col.key);
    if (raw) {
      const vals = raw.split(",").map(v => v.trim()).filter(Boolean);
      if (vals.length) out[col.key] = vals;
    }
  }
  return out;
}

export function useColumnFilters<T>(config: ColumnFilterConfig<T>[], rows: T[], options?: UseColumnFiltersOptions) {
  const serverMode = !!options?.distinctValues;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlFilters = useMemo(() => parseFilters(config, searchParams), [config, searchParams]);

  const [filters, setFilters] = useState<FilterMap>(urlFilters);

  const [prevUrl, setPrevUrl] = useState(urlFilters);
  if (prevUrl !== urlFilters) {
    setPrevUrl(urlFilters);
    setFilters(urlFilters);
  }

  const commit = useCallback((next: FilterMap) => {
    const params = new URLSearchParams(window.location.search);
    for (const col of config) {
      const vals = (next[col.key] ?? []).slice().sort();
      if (vals.length) params.set(col.key, vals.join(","));
      else params.delete(col.key);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [config, pathname, router]);

  const apply = useCallback((next: FilterMap) => {
    const clean: FilterMap = {};
    for (const k of Object.keys(next)) {
      const vals = (next[k] ?? []).filter(Boolean);
      if (vals.length) clean[k] = vals;
    }
    setFilters(clean);
    commit(clean);
  }, [commit]);

  const clearColumn = useCallback((key: string) => {
    if (!(key in filters)) return;
    const next = { ...filters };
    delete next[key];
    apply(next);
  }, [filters, apply]);

  const clearAll = useCallback(() => apply({}), [apply]);

  const localDistinct = useMemo(() => {
    const map: Record<string, ColumnFilterValue[]> = {};
    for (const col of config) {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const v = cellValueToLabel(col.getValue(row));
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      map[col.key] = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
    }
    return map;
  }, [config, rows]);

  // Server-paginated tables only send values for the columns the page knows
  // about. Fall back per column so a filter added to the table without a matching
  // group-by still lists the values on the current page instead of showing an
  // empty dropdown.
  const distinctValues = useMemo<Record<string, ColumnFilterValue[]>>(() => {
    const server = options?.distinctValues;
    if (!server) return localDistinct;
    const merged: Record<string, ColumnFilterValue[]> = {};
    for (const col of config) {
      merged[col.key] = server[col.key] ?? localDistinct[col.key] ?? [];
    }
    return merged;
  }, [config, localDistinct, options?.distinctValues]);

  const activeFilterCount = Object.keys(filters).length;

  const filteredRows = useMemo(() => {
    if (serverMode) return rows;
    const active = config.filter(col => (filters[col.key]?.length ?? 0) > 0);
    if (active.length === 0) return rows;
    return rows.filter(row =>
      active.every(col => filters[col.key]?.includes(cellValueToLabel(col.getValue(row))))
    );
  }, [serverMode, config, rows, filters]);

  const applyColumn = useCallback((key: string, value: string[]) => {
    apply({ ...filters, [key]: value });
  }, [filters, apply]);

  return { filteredRows, distinctValues, filters, applyColumn, clearColumn, clearAll, activeFilterCount };
}

interface ColumnFilterHeaderProps {
  label: React.ReactNode;
  values: { value: string; count: number }[];
  selected: string[];
  onApply: (values: string[]) => void;
  className?: string;
  align?: "left" | "right";
  portalZIndex?: number;
}

export function ColumnFilterHeader({
  label,
  values,
  selected,
  onApply,
  className,
  align = "left",
  portalZIndex = 50,
}: ColumnFilterHeaderProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  const isActive = selected.length > 0;
  const q = search.trim().toLowerCase();
  const shown = q ? values.filter(v => v.value.toLowerCase().includes(q)) : values;
  const allShownSelected = shown.length > 0 && shown.every(v => draft.has(v.value));

  const openDropdown = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setAnchor({
        top: rect.bottom + 6,
        left: align === "right" ? Math.max(8, rect.right - 280) : rect.left,
        width: 280,
      });
    }
    setDraft(new Set(selected));
    setSearch("");
    setOpen(true);
  };

  const closeDropdown = () => {
    setOpen(false);
    setDraft(new Set());
  };

  const toggleDraft = (value: string) => {
    const next = new Set(draft);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setDraft(next);
  };

  const toggleAllDraft = (checked: boolean, currentShown: { value: string }[]) => {
    const next = new Set(draft);
    if (checked) {
      currentShown.forEach(v => next.add(v.value));
    } else {
      currentShown.forEach(v => next.delete(v.value));
    }
    setDraft(next);
  };

  const apply = () => {
    onApply([...draft]);
    closeDropdown();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown();
    };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      closeDropdown();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <th className={`relative ${className ?? ""}`}>
      <div className={`inline-flex items-center gap-1 whitespace-nowrap ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span>{label}</span>
        <button
          ref={triggerRef}
          onClick={openDropdown}
          title="Filter"
          aria-haspopup="true"
          aria-expanded={open}
          className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      {open && anchor && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: portalZIndex - 1 }} onClick={closeDropdown} />
          <div
            ref={panelRef}
            className="fixed rounded-xl border bg-popover text-popover-foreground shadow-xl"
            style={{ top: anchor.top, left: anchor.left, width: anchor.width, zIndex: portalZIndex }}
          >
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide">
                {isActive ? `${draft.size} selected` : "Filter"}
              </span>
              <button
                onClick={() => setDraft(new Set())}
                className="text-xs font-medium text-primary hover:underline"
              >
                Clear
              </button>
            </div>

            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search values..."
                  className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/60 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-primary size-3.5"
                checked={allShownSelected}
                onChange={e => toggleAllDraft(e.target.checked, shown)}
              />
              <span>
                {allShownSelected && shown.length === values.length
                  ? "Deselect All"
                  : "Select All"}
              </span>
              {q && <span className="text-muted-foreground">({shown.length})</span>}
            </label>

            <div className="max-h-56 overflow-y-auto">
              {shown.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">No matching values.</div>
              ) : (
                shown.map(v => {
                  const checked = draft.has(v.value);
                  return (
                    <label
                      key={v.value}
                      onClick={() => toggleDraft(v.value)}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/60 select-none"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                            checked ? "bg-primary border-primary text-primary-foreground" : "border-input"
                          }`}
                        >
                          {checked && <Check className="size-3" />}
                        </span>
                        <span className="truncate">{v.value}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {v.count}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t p-2">
              <button
                onClick={closeDropdown}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/60"
              >
                Cancel
              </button>
              <button
                onClick={apply}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Apply
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </th>
  );
}