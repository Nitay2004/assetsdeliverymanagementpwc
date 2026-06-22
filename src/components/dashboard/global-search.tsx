"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Loader2, Package, ShoppingCart, Wrench, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchResult } from "@/app/actions/search";

const TYPE_ICONS: Record<string, React.ElementType> = {
  inventory: Package,
  order: ShoppingCart,
  asset: Wrench,
  docket: FileText,
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K to focus
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await globalSearch(query);
        setResults(res);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback((r: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(r.href || "/dashboard");
  }, [router]);

  return (
    <div ref={ref} className="relative flex-1 max-w-md mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder='Search… (⌘K)'
          className="w-full rounded-xl border-0 bg-white/40 dark:bg-white/5 backdrop-blur-xl pl-9 pr-10 py-2.5 text-sm shadow-inner placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-white/60 dark:focus:bg-white/10 transition-all"
          maxLength={100}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
        ) : (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded-md border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/50">
            ⌘K
          </kbd>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 rounded-xl bg-white/80 dark:bg-[#0d0d1a]/90 backdrop-blur-2xl shadow-xl border border-white/20 dark:border-white/5 overflow-hidden animate-in fade-in slide-in-from-top-1 z-50">
          {results.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.map((r) => {
                const Icon = TYPE_ICONS[r.type] ?? Search;
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <Icon className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                    </div>
                    <span className="text-xs text-muted-foreground/40 shrink-0">↗</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
