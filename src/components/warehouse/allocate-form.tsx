"use client";

import { useState, useMemo } from "react";
import { allocateInventoryToOrder } from "@/app/actions/warehouse";
import { Search } from "lucide-react";

interface InventoryItem {
  id: string;
  serialNumber: string;
  model: string;
  specs: string | null;
  status: string;
  employeeName: string | null;
  shippingAddress: string | null;
  city: string | null;
  state: string | null;
}

interface Props {
  orderId: string;
  requiredCount: number;
  availableItems: InventoryItem[];
}

export function AllocateForm({ orderId, requiredCount, availableItems }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    if (!search.trim()) return availableItems;
    const lowerSearch = search.toLowerCase();
    return availableItems.filter((item) => 
      item.serialNumber.toLowerCase().includes(lowerSearch) ||
      item.employeeName?.toLowerCase().includes(lowerSearch) ||
      item.city?.toLowerCase().includes(lowerSearch) ||
      item.model.toLowerCase().includes(lowerSearch)
    );
  }, [availableItems, search]);

  const toggleItem = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < requiredCount
        ? [...prev, id]
        : prev
    );
  };

  const handleSubmit = async () => {
    if (selected.length !== requiredCount) {
      setMessage({ ok: false, text: `Please select exactly ${requiredCount} laptop(s).` });
      return;
    }
    setLoading(true);
    const result = await allocateInventoryToOrder(orderId, selected);
    setLoading(false);
    if (result.success) {
      setMessage({ ok: true, text: "Laptops successfully allocated to this order!" });
      setSelected([]);
      setSearch("");
    } else {
      setMessage({ ok: false, text: result.error ?? "Allocation failed." });
    }
  };

  if (availableItems.length === 0) {
    return (
      <p className="text-sm text-red-500 mt-2">
        ⚠️ No available inventory. Please add laptops to the inventory first.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Select <span className="font-semibold text-primary">{requiredCount}</span> laptop(s) from available inventory:
        </p>
        
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Serial, Employee, City..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-sm border rounded-lg w-full sm:w-64 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="grid gap-2 max-h-[300px] overflow-y-auto border rounded-lg p-2 bg-muted/5">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No matching laptops found.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isChecked = selected.includes(item.id);
            return (
              <label
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                  isChecked ? "bg-primary/5 border-primary" : "bg-background hover:bg-muted/40 border-transparent shadow-sm"
                }`}
              >
                <div className="pt-1">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={isChecked}
                    onChange={() => toggleItem(item.id)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm text-foreground">{item.serialNumber}</p>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {item.model}
                    </span>
                  </div>
                  
                  {item.employeeName ? (
                    <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Employee: </span>
                        <span className="font-medium text-foreground">{item.employeeName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Location: </span>
                        <span className="font-medium text-foreground">
                          {[item.city, item.state].filter(Boolean).join(", ") || "Unknown"}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Address: </span>
                        <span className="text-foreground">{item.shippingAddress || "N/A"}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.specs}
                    </p>
                  )}
                </div>
              </label>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button
          onClick={handleSubmit}
          disabled={loading || selected.length !== requiredCount}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm"
        >
          {loading ? "Allocating…" : `Allocate ${selected.length}/${requiredCount} Selected`}
        </button>
        {message && (
          <p className={`text-sm font-medium ${message.ok ? "text-green-600" : "text-red-500"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
