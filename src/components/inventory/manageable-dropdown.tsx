"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

interface ManageableDropdownProps {
  name: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  allOptions: { id: string; category: string; value: string }[];
  category: string;
  onAdd: (category: string, val: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  required?: boolean;
}

export function ManageableDropdown({
  name,
  placeholder,
  value,
  onChange,
  options,
  allOptions,
  category,
  onAdd,
  onDelete,
  required
}: ManageableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
      const valToAdd = newValue.trim();
      await onAdd(category, valToAdd);
      setNewValue("");
      onChange(valToAdd); // auto-select the newly added option
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Hidden input to ensure form submission works seamlessly */}
      <input type="hidden" name={name} value={value} required={required} />
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border px-3 py-2 text-sm bg-background text-left min-h-[38px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow z-10 relative ${
          isOpen ? "rounded-t-md border-b-transparent" : "rounded-md"
        }`}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground truncate"}>
          {value || placeholder}
        </span>
        <ChevronDown className={`size-4 text-muted-foreground shrink-0 ml-2 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full top-full left-0 bg-background border border-t-0 rounded-b-md shadow-lg flex flex-col max-h-[300px] overflow-hidden">
          <div className="overflow-y-auto p-1 space-y-0.5 flex-1 min-h-0">
            <button
              type="button"
              onClick={() => { onChange(""); setIsOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted text-muted-foreground transition-colors"
            >
              Clear selection
            </button>
            {options.map((optVal) => {
              const optItem = allOptions.find(o => o.category === category && o.value === optVal);
              return (
                <div key={optVal} className="group flex items-center justify-between px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors">
                  <button
                    type="button"
                    className="flex-1 text-left truncate mr-2"
                    onClick={() => { onChange(optVal); setIsOpen(false); }}
                  >
                    {optVal}
                  </button>
                  {optItem && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await onDelete(optItem.id);
                        if (value === optVal) onChange(""); // clear if deleted
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all shrink-0"
                      title="Delete option"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t p-2 bg-muted/30 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Add new option..."
                className="flex-1 min-w-0 rounded-md border px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newValue.trim() || isAdding}
                className="px-3 rounded-md bg-primary text-primary-foreground disabled:opacity-50 flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { getDistinctFieldValues, addDropdownOption, deleteDropdownOption, seedDropdownOptions } from "@/app/actions/inventory";
import { useToast } from "@/hooks/use-toast";

export function useDropdownData() {
  const [data, setData] = useState<{ entities: string[]; purposes: string[]; imageTypes: string[]; warehouseLocations: string[]; allOptions: any[] } | null>(null);
  const { toast } = useToast();

  async function loadData() {
    let v = await getDistinctFieldValues();
    if (v.entities.length === 0 && v.purposes.length === 0 && v.imageTypes.length === 0) {
      await seedDropdownOptions();
      v = await getDistinctFieldValues();
    }
    setData(v);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddOption(category: string, value: string) {
    if (!value.trim()) return;
    await addDropdownOption(category, value.trim());
    await loadData();
    toast({ title: "Added", description: `"${value.trim()}" added to ${category}.`, variant: "success" });
  }

  async function handleDeleteOption(id: string) {
    await deleteDropdownOption(id);
    await loadData();
    toast({ title: "Deleted", description: "Value removed.", variant: "success" });
  }

  return { data, handleAddOption, handleDeleteOption };
}

export function SmartDropdownField({
  name,
  defaultValue,
  placeholder,
  category,
  options,
  allOptions,
  onAdd,
  onDelete,
  required,
}: any) {
  const [value, setValue] = useState(defaultValue || "");

  useEffect(() => {
    if (defaultValue !== undefined && value === "") {
      setValue(defaultValue || "");
    }
  }, [defaultValue]);

  return (
    <ManageableDropdown
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={setValue}
      options={options}
      allOptions={allOptions}
      category={category}
      onAdd={onAdd}
      onDelete={onDelete}
      required={required}
    />
  );
}
