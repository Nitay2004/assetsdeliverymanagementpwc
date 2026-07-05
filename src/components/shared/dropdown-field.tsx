"use client";

import { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Plus, Trash2, Loader2 } from "lucide-react";

interface Option {
  id: string;
  value: string;
}

interface DropdownFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  onAdd: (value: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  placeholder?: string;
}

export function DropdownField({
  label,
  value,
  onChange,
  options,
  onAdd,
  onDelete,
  placeholder,
}: DropdownFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleAdd() {
    if (!newValue.trim() || isAdding) return;
    setIsAdding(true);
    try {
      await onAdd(newValue.trim());
      onChange(newValue.trim());
      setNewValue("");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="relative w-full" ref={ref}>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border px-3 py-2 text-sm bg-background text-left min-h-[38px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow ${
          isOpen ? "rounded-t-md border-b-transparent" : "rounded-md"
        }`}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground truncate"}>
          {value || (placeholder || `Select ${label.toLowerCase()}...`)}
        </span>
        <ChevronDown className={`size-4 text-muted-foreground shrink-0 ml-2 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full top-full left-0 bg-background border border-t-0 rounded-b-md shadow-lg flex flex-col max-h-[260px] overflow-hidden">
          <div className="overflow-y-auto p-1 space-y-0.5 flex-1 min-h-0">
            <button
              type="button"
              onClick={() => { onChange(""); setIsOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted text-muted-foreground transition-colors"
            >
              Clear selection
            </button>
            {options.map((opt) => (
              <div key={opt.id} className="group flex items-center justify-between px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors">
                <button
                  type="button"
                  className="flex-1 text-left truncate mr-2"
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                >
                  {opt.value}
                </button>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await onDelete(opt.id);
                    if (value === opt.value) onChange("");
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all shrink-0"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t p-2 bg-muted/30 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                placeholder="Add new option..."
                className="flex-1 min-w-0 rounded-md border px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newValue.trim() || isAdding}
                className="px-3 rounded-md bg-primary text-primary-foreground disabled:opacity-50 flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors"
              >
                {isAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
