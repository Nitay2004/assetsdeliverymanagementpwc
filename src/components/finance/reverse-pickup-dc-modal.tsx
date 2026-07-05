"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus, Trash2, Loader2, FileText, ChevronDown } from "lucide-react";
import { getWarehouses, createWarehouse, getNextDcNumber, generateReversePickupDc, getReversePickupForDc, getBillToLocationOptions, addBillToLocationOption, deleteBillToLocationOption, getDispatchedThroughOptions, addDispatchedThroughOption, deleteDispatchedThroughOption } from "@/app/actions/dc";
import { DropdownField } from "@/components/shared/dropdown-field";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface ReversePickupDcModalProps {
  rpId: string;
  open: boolean;
  onClose: () => void;
}

interface ItemRow {
  description: string;
  hsnSac: string;
  quantity: number;
  rate: number;
}

interface Warehouse {
  id: string;
  name: string;
  location: string | null;
}

export function ReversePickupDcModal({ rpId, open, onClose }: ReversePickupDcModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [autoDcNumber, setAutoDcNumber] = useState("");
  const [billToOptions, setBillToOptions] = useState<{ id: string; value: string }[]>([]);
  const [dispatchedThroughOptions, setDispatchedThroughOptions] = useState<{ id: string; value: string }[]>([]);

  const [warehouseId, setWarehouseId] = useState("");
  const [shipToLocation, setShipToLocation] = useState("");
  const [billToLocation, setBillToLocation] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [otherReferences, setOtherReferences] = useState("");
  const [buyersOrderNo, setBuyersOrderNo] = useState("");
  const [buyersOrderDate, setBuyersOrderDate] = useState("");
  const [dispatchDocNo, setDispatchDocNo] = useState("");
  const [dispatchedThrough, setDispatchedThrough] = useState("");
  const [destination, setDestination] = useState("");
  const [termsOfDelivery, setTermsOfDelivery] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ description: "", hsnSac: "", quantity: 1, rate: 0 }]);

  const loadData = useCallback(async () => {
    const [wh, dcNum, rpData, billToOpts, dtOpts] = await Promise.all([
      getWarehouses(),
      getNextDcNumber(),
      getReversePickupForDc(rpId),
      getBillToLocationOptions(),
      getDispatchedThroughOptions(),
    ]);
    setWarehouses(wh);
    setAutoDcNumber(dcNum);
    setBillToOptions(billToOpts);
    setDispatchedThroughOptions(dtOpts);

    if (rpData) {
      setShipToLocation(rpData.fullAddress || rpData.deliveryLocation || "");
      if (rpData.items.length > 0) {
        setItems(rpData.items);
      }
      if (rpData.warehouseLocation) {
        const matched = wh.find(w => w.name === rpData.warehouseLocation || w.location === rpData.warehouseLocation);
        if (matched) setWarehouseId(matched.id);
      }
    }
  }, [rpId]);

  useEffect(() => {
    if (open) {
      loadData();
      setWarehouseId("");
      setShipToLocation("");
      setBillToLocation("");
      setModeOfPayment("");
      setReferenceNo("");
      setReferenceDate("");
      setOtherReferences("");
      setBuyersOrderNo("");
      setBuyersOrderDate("");
      setDispatchDocNo("");
      setDispatchedThrough("");
      setDestination("");
      setTermsOfDelivery("");
    }
  }, [open, loadData]);

  function addItem() {
    setItems([...items, { description: "", hsnSac: "", quantity: 1, rate: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ItemRow, value: string | number) {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      return { ...item, [field]: value };
    });
    setItems(updated);
  }

  const totals = items.reduce(
    (acc, item) => {
      const amount = item.quantity * item.rate;
      return {
        totalAmount: acc.totalAmount + amount,
        totalQty: acc.totalQty + item.quantity,
      };
    },
    { totalAmount: 0, totalQty: 0 }
  );
  const totalTaxableValue = totals.totalAmount;
  const igstRate = 18;
  const igstAmount = totalTaxableValue * (igstRate / 100);
  const totalTaxAmount = igstAmount;

  async function handleSubmit() {
    if (!shipToLocation.trim() || !billToLocation.trim()) {
      toast({ title: "Validation", description: "Ship To and Bill To locations are required.", variant: "error" });
      return;
    }
    if (items.length === 0 || !items[0]?.description.trim()) {
      toast({ title: "Validation", description: "At least one item with description is required.", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const result = await generateReversePickupDc(rpId, {
        warehouseId: warehouseId || undefined,
        shipToLocation: shipToLocation.trim(),
        billToLocation: billToLocation.trim(),
        modeOfPayment,
        referenceNo,
        referenceDate: referenceDate || undefined,
        otherReferences,
        buyersOrderNo,
        buyersOrderDate: buyersOrderDate || undefined,
        dispatchDocNo,
        dispatchedThrough,
        destination,
        termsOfDelivery,
        items: items.map(item => ({
          description: item.description,
          hsnSac: item.hsnSac,
          quantity: item.quantity,
          rate: item.rate,
        })),
      });

      toast({ title: "DC Generated", description: `DC ${result.dcNumber} created for reverse pickup.`, variant: "success" });

      const pdfUrl = `/api/dc/${result.id}/pdf`;
      window.open(pdfUrl, "_blank");

      router.refresh();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const selectedWarehouse = warehouses.find(w => w.id === warehouseId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-4xl mx-4 overflow-visible">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-background z-10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Generate Delivery Challan — Reverse Pickup</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{autoDcNumber}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5 relative">
              <label className="text-xs font-medium text-foreground">Warehouse Location</label>
              <WarehouseDropdown
                warehouses={warehouses}
                value={warehouseId}
                onChange={setWarehouseId}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Ship To Location <span className="text-destructive">*</span></label>
              <textarea
                value={shipToLocation}
                onChange={e => setShipToLocation(e.target.value)}
                placeholder="Full address with pincode"
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <DropdownField
                label="Bill To Location *"
                value={billToLocation}
                onChange={setBillToLocation}
                options={billToOptions}
                onAdd={async (val) => { await addBillToLocationOption(val); setBillToOptions(await getBillToLocationOptions()); }}
                onDelete={async (id) => { await deleteBillToLocationOption(id); setBillToOptions(await getBillToLocationOptions()); }}
                placeholder="Full address with pincode"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Reference Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Mode / Terms of Payment</label>
                <input
                  value={modeOfPayment}
                  onChange={e => setModeOfPayment(e.target.value)}
                  placeholder="e.g. Bank Transfer"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Reference No.</label>
                <input
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  placeholder="Reference number"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Reference Date</label>
                <input
                  type="date"
                  value={referenceDate}
                  onChange={e => setReferenceDate(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Other References</label>
                <input
                  value={otherReferences}
                  onChange={e => setOtherReferences(e.target.value)}
                  placeholder="Other references"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Buyer's Order No.</label>
                <input
                  value={buyersOrderNo}
                  onChange={e => setBuyersOrderNo(e.target.value)}
                  placeholder="Buyer's order no"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Buyer's Order Date</label>
                <input
                  type="date"
                  value={buyersOrderDate}
                  onChange={e => setBuyersOrderDate(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Dispatch Doc No.</label>
                <input
                  value={dispatchDocNo}
                  onChange={e => setDispatchDocNo(e.target.value)}
                  placeholder="Dispatch doc no"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <DropdownField
                  label="Dispatched Through"
                  value={dispatchedThrough}
                  onChange={setDispatchedThrough}
                  options={dispatchedThroughOptions}
                  onAdd={async (val) => { await addDispatchedThroughOption(val); setDispatchedThroughOptions(await getDispatchedThroughOptions()); }}
                  onDelete={async (id) => { await deleteDispatchedThroughOption(id); setDispatchedThroughOptions(await getDispatchedThroughOptions()); }}
                  placeholder="Select..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Destination</label>
                <input
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="Destination"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Terms of Delivery</label>
                <input
                  value={termsOfDelivery}
                  onChange={e => setTermsOfDelivery(e.target.value)}
                  placeholder="Terms of delivery"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Item Details</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus className="size-3.5" />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold w-[30%]">Description of Goods</th>
                    <th className="px-3 py-2 text-left font-semibold w-[12%]">HSN/SAC</th>
                    <th className="px-3 py-2 text-right font-semibold w-[8%]">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold w-[12%]">Rate (INR)</th>
                    <th className="px-3 py-2 text-right font-semibold w-[12%]">Amount</th>
                    <th className="px-3 py-2 text-center font-semibold w-[6%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, index) => {
                    const amount = item.quantity * item.rate;
                    return (
                      <tr key={index} className="hover:bg-muted/10">
                        <td className="px-3 py-1.5">
                          <input
                            value={item.description}
                            onChange={e => updateItem(index, "description", e.target.value)}
                            placeholder="Description"
                            className="w-full rounded border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            value={item.hsnSac}
                            onChange={e => updateItem(index, "hsnSac", e.target.value)}
                            placeholder="HSN"
                            className="w-full rounded border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                            className="w-full rounded border bg-background px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={e => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                            className="w-full rounded border bg-background px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-xs text-right font-medium text-muted-foreground">
                          {amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            disabled={items.length <= 1}
                            className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/20 text-xs font-semibold">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-right">Totals:</td>
                    <td className="px-3 py-2 text-right">{totals.totalQty}</td>
                    <td></td>
                    <td className="px-3 py-2 text-right">{totals.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Charges Summary</h3>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div className="text-xs text-muted-foreground">Total Amount (Taxable Value):</div>
              <div className="text-xs font-semibold text-right">{totalTaxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
              <div className="text-xs text-muted-foreground">IGST @ {igstRate}%:</div>
              <div className="text-xs font-semibold text-right">{igstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
              <div className="text-xs text-muted-foreground border-t pt-1 font-medium">Total Tax Amount:</div>
              <div className="text-xs font-semibold text-right border-t pt-1">{totalTaxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/10">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            {saving ? "Generating..." : "Generate DC & Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WarehouseDropdown({
  warehouses,
  value,
  onChange,
}: {
  warehouses: Warehouse[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = warehouses.find(w => w.id === value);

  async function handleAdd() {
    if (!newName.trim() || isAdding) return;
    setIsAdding(true);
    try {
      const wh = await createWarehouse(newName.trim());
      onChange(wh.id);
      setNewName("");
      toast({ title: "Added", description: `Warehouse "${newName.trim()}" created.`, variant: "success" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border bg-background px-3 py-2 text-sm text-left min-h-[38px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow ${
          isOpen ? "rounded-t-md border-b-transparent" : "rounded-lg"
        }`}
      >
        <span className={value ? "text-foreground truncate" : "text-muted-foreground"}>
          {selected ? `${selected.name}${selected.location ? ` - ${selected.location}` : ""}` : "Select warehouse..."}
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
            {warehouses.map(w => (
              <button
                key={w.id}
                type="button"
                onClick={() => { onChange(w.id); setIsOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors ${w.id === value ? "bg-muted/50 font-medium" : ""}`}
              >
                {w.name}{w.location ? ` - ${w.location}` : ""}
              </button>
            ))}
          </div>
          <div className="border-t p-2 bg-muted/30 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Add new warehouse..."
                className="flex-1 min-w-0 rounded-md border px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newName.trim() || isAdding}
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