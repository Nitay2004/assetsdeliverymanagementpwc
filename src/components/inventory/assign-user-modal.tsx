"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, Loader2, UserPlus, Users, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { reassignItem, getDistinctFieldValues, addDropdownOption, deleteDropdownOption, seedDropdownOptions } from "@/app/actions/inventory";
import { ManageableDropdown, useDropdownData } from "@/components/inventory/manageable-dropdown";
import { PincodeInput } from "@/components/shared/pincode-input";
import { useRouter } from "next/navigation";

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "single" | "multiple";
}

interface AssetItem {
  id: string;
  serialNumber: string;
  model: string;
  status: string;
  employeeName: string | null;
  invoicingWarehouse: string | null;
}

export function AssignUserModal({ open, onClose, mode }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<"single" | "multiple">(mode);

  // Single assign state
  const [serialSearch, setSerialSearch] = useState("");
  const [foundItem, setFoundItem] = useState<AssetItem | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Multiple assign state
  const [availableItems, setAvailableItems] = useState<AssetItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Assignment form state
  const [showForm, setShowForm] = useState(false);
  const [formItem, setFormItem] = useState<AssetItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Dropdown state
  const { data: dropdownData, handleAddOption, handleDeleteOption } = useDropdownData();
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedPurpose, setSelectedPurpose] = useState("");
  const [selectedImageType, setSelectedImageType] = useState("");
  const [selectedAdaptor, setSelectedAdaptor] = useState("");
  const [selectedHeadset, setSelectedHeadset] = useState("");
  const [selectedSticker, setSelectedSticker] = useState("");

  useEffect(() => {
    if (open) {
      setActiveMode(mode);
      resetAll();
      if (mode === "multiple") loadAvailableItems();
    }
  }, [open, mode]);

  function resetAll() {
    setSerialSearch("");
    setFoundItem(null);
    setSearchError("");
    setSelectedIds(new Set());
    setShowForm(false);
    setFormItem(null);
    setSelectedEntity("");
    setSelectedPurpose("");
    setSelectedImageType("");
    setSelectedAdaptor("");
    setSelectedHeadset("");
    setSelectedSticker("");
  }

  async function loadAvailableItems() {
    setLoadingItems(true);
    try {
      const res = await fetch("/api/inventory-available");
      const data = await res.json();
      if (data.items) setAvailableItems(data.items);
    } catch {
      // fallback: items will be empty
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleSerialLookup() {
    if (!serialSearch.trim()) return;
    setSearching(true);
    setSearchError("");
    setFoundItem(null);
    try {
      const res = await fetch(`/api/inventory-lookup?serial=${encodeURIComponent(serialSearch.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.item) {
        setSearchError(data.error || "Asset not found");
        return;
      }
      setFoundItem(data.item);
    } catch {
      setSearchError("Search failed");
    } finally {
      setSearching(false);
    }
  }

  function handleAssignSingle() {
    if (!foundItem) return;
    setFormItem(foundItem);
    setShowForm(true);
  }

  function handleAssignMultiple() {
    if (selectedIds.size === 0) return;
    // Open form for first selected item, then assign all with same data
    const firstItem = availableItems.find(i => selectedIds.has(i.id));
    if (firstItem) {
      setFormItem(firstItem);
      setShowForm(true);
    }
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);

      if (activeMode === "single" && formItem) {
        await reassignItem(formItem.id, form);
        toast({ title: "Assigned", description: `${formItem.serialNumber} assigned successfully.`, variant: "success" });
      } else if (activeMode === "multiple") {
        const ids = Array.from(selectedIds);
        let successCount = 0;
        for (const id of ids) {
          try {
            await reassignItem(id, form);
            successCount++;
          } catch {
            // continue with next
          }
        }
        toast({ title: "Assigned", description: `${successCount} of ${ids.length} items assigned successfully.`, variant: "success" });
      }

      resetAll();
      onClose();
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Assignment failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const entities = dropdownData?.entities ?? [];
  const purposes = dropdownData?.purposes ?? [];
  const imageTypes = dropdownData?.imageTypes ?? [];
  const allOptions = dropdownData?.allOptions ?? [];
  const adaptorAddeds = allOptions.filter(o => o.category === "adaptorAdded").map(o => o.value);
  const accessoryHeadsetMouses = allOptions.filter(o => o.category === "accessoryHeadsetMouse").map(o => o.value);
  const stickerColours = allOptions.filter(o => o.category === "stickerColour").map(o => o.value);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-background rounded-2xl shadow-2xl border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <UserPlus className="size-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Assign User to Asset</h2>
              <p className="text-xs text-muted-foreground">Assign inventory items to users</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        {!showForm && (
          <div className="flex border-b shrink-0">
            <button
              onClick={() => { setActiveMode("single"); resetAll(); if (mode === "multiple") loadAvailableItems(); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeMode === "single"
                  ? "border-b-2 border-primary text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <UserPlus className="size-4" />
              Single Assign
            </button>
            <button
              onClick={() => { setActiveMode("multiple"); resetAll(); loadAvailableItems(); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeMode === "multiple"
                  ? "border-b-2 border-primary text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Users className="size-4" />
              Multiple Assign
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!showForm ? (
            activeMode === "single" ? (
              /* ─── Single Assign ─── */
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      value={serialSearch}
                      onChange={e => setSerialSearch(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSerialLookup()}
                      placeholder="Enter Serial Number..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button
                    onClick={handleSerialLookup}
                    disabled={searching || !serialSearch.trim()}
                    className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    Search
                  </button>
                </div>

                {searchError && (
                  <p className="text-sm text-destructive">{searchError}</p>
                )}

                {foundItem && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{foundItem.serialNumber}</p>
                        <p className="text-xs text-muted-foreground">{foundItem.model}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        foundItem.status === "AVAILABLE" ? "bg-green-100 text-green-700" :
                        foundItem.status === "ALLOCATED" ? "bg-blue-100 text-blue-700" :
                        foundItem.status === "NEW" ? "bg-purple-100 text-purple-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {foundItem.status}
                      </span>
                    </div>
                    {foundItem.employeeName && (
                      <p className="text-xs text-muted-foreground">Currently assigned to: <span className="font-medium text-foreground">{foundItem.employeeName}</span></p>
                    )}
                    <button
                      onClick={handleAssignSingle}
                      className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <UserPlus className="size-4" />
                      {foundItem.employeeName ? "Re-Assign to New User" : "Assign to User"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ─── Multiple Assign ─── */
              <div className="space-y-4">
                {loadingItems ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : availableItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No available assets found.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {availableItems.length} available asset(s) — {selectedIds.size} selected
                      </p>
                      <button
                        onClick={() => {
                          if (selectedIds.size === availableItems.length) {
                            setSelectedIds(new Set());
                          } else {
                            setSelectedIds(new Set(availableItems.map(i => i.id)));
                          }
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        {selectedIds.size === availableItems.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="px-3 py-2.5 text-left w-10">
                              <input
                                type="checkbox"
                                checked={selectedIds.size === availableItems.length && availableItems.length > 0}
                                onChange={e => {
                                  if (e.target.checked) setSelectedIds(new Set(availableItems.map(i => i.id)));
                                  else setSelectedIds(new Set());
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Serial No</th>
                            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Model</th>
                            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Warehouse</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availableItems.map(item => (
                            <tr
                              key={item.id}
                              className={`border-b last:border-b-0 cursor-pointer transition-colors ${
                                selectedIds.has(item.id) ? "bg-primary/5" : "hover:bg-muted/30"
                              }`}
                              onClick={() => {
                                const next = new Set(selectedIds);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                setSelectedIds(next);
                              }}
                            >
                              <td className="px-3 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(item.id)}
                                  onChange={e => {
                                    const next = new Set(selectedIds);
                                    if (e.target.checked) next.add(item.id);
                                    else next.delete(item.id);
                                    setSelectedIds(next);
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-3 py-2.5 font-medium">{item.serialNumber}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{item.model}</td>
                              <td className="px-3 py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.status === "AVAILABLE" ? "bg-green-100 text-green-700" :
                                  item.status === "NEW" ? "bg-purple-100 text-purple-700" :
                                  "bg-slate-100 text-slate-700"
                                }`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">{item.invoicingWarehouse || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={handleAssignMultiple}
                      disabled={selectedIds.size === 0}
                      className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <UserPlus className="size-4" />
                      Assign {selectedIds.size > 0 ? `${selectedIds.size} Item(s)` : ""}
                    </button>
                  </>
                )}
              </div>
            )
          ) : (
            /* ─── Assignment Form ─── */
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Assigning: <span className="text-primary">{formItem?.serialNumber}</span>
                  {activeMode === "multiple" && selectedIds.size > 1 && (
                    <span className="text-muted-foreground ml-1">(+ {selectedIds.size - 1} more)</span>
                  )}
                </p>
                <button type="button" onClick={() => { setShowForm(false); setFormItem(null); }} className="text-xs text-muted-foreground hover:text-foreground">
                  ← Back to selection
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input name="partner" placeholder="Partner" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                <input name="sr" placeholder="Sr #" type="number" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                <ManageableDropdown
                  name="entity"
                  placeholder="Entity"
                  value={selectedEntity}
                  onChange={setSelectedEntity}
                  options={entities}
                  allOptions={allOptions}
                  category="entity"
                  onAdd={handleAddOption as any}
                  onDelete={handleDeleteOption}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="employeeName" placeholder="Employee Name" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                <input name="emailId" type="email" placeholder="Email ID" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="mobileNumber" placeholder="Mobile Number" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                <input name="alternatePhoneNumber" placeholder="Alternate Phone" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
              </div>

              <input name="shippingAddress" placeholder="Shipping Address" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />

              <PincodeInput />

              <div className="grid grid-cols-2 gap-2">
                <ManageableDropdown
                  name="purpose"
                  placeholder="Purpose"
                  value={selectedPurpose}
                  onChange={setSelectedPurpose}
                  options={purposes}
                  allOptions={allOptions}
                  category="purpose"
                  onAdd={handleAddOption as any}
                  onDelete={handleDeleteOption}
                />
                <ManageableDropdown
                  name="imageType"
                  placeholder="Image Type"
                  value={selectedImageType}
                  onChange={setSelectedImageType}
                  options={imageTypes}
                  allOptions={allOptions}
                  category="imageType"
                  onAdd={handleAddOption as any}
                  onDelete={handleDeleteOption}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Request Date</label>
                  <input name="requestDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Count</label>
                  <input name="count" type="number" min="1" defaultValue="1" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                </div>
              </div>

              <div className="pt-2 border-t mt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Timeline & SLA</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input name="emailReceivedHour" placeholder="Email Received Hour" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  <input name="cutOffStatus" placeholder="Cut Off Status" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">SLA Start Date <span className="text-red-500">*</span></label>
                    <input name="slaStartDate" type="date" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Actual Delivery Date</label>
                    <input name="actualDeliveryDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input name="slaState" placeholder="State (SLA)" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  <input name="zone" placeholder="Zone" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  <input name="tier" placeholder="Tier" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input name="odaLocation" placeholder="ODA Location" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  <input name="tat" placeholder="TAT" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  <input name="deliveryTatDays" placeholder="Delivery TAT (Days)" type="number" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input name="slaStatus" placeholder="SLA Missed/Met" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Acceptance Date</label>
                    <input name="laptopAcceptanceDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t mt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Accessories & Setup</p>
                <div className="grid grid-cols-3 gap-2">
                  <ManageableDropdown
                    name="adaptorAdded"
                    placeholder="Adaptor Added"
                    value={selectedAdaptor}
                    onChange={setSelectedAdaptor}
                    options={adaptorAddeds}
                    allOptions={allOptions}
                    category="adaptorAdded"
                    onAdd={handleAddOption as any}
                    onDelete={handleDeleteOption}
                    required
                  />
                  <ManageableDropdown
                    name="accessoryHeadsetMouse"
                    placeholder="Headset/Mouse"
                    value={selectedHeadset}
                    onChange={setSelectedHeadset}
                    options={accessoryHeadsetMouses}
                    allOptions={allOptions}
                    category="accessoryHeadsetMouse"
                    onAdd={handleAddOption as any}
                    onDelete={handleDeleteOption}
                    required
                  />
                  <ManageableDropdown
                    name="stickerColour"
                    placeholder="Sticker Colour"
                    value={selectedSticker}
                    onChange={setSelectedSticker}
                    options={stickerColours}
                    allOptions={allOptions}
                    category="stickerColour"
                    onAdd={handleAddOption as any}
                    onDelete={handleDeleteOption}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? "Saving..." : activeMode === "multiple" ? `Assign ${selectedIds.size} Item(s)` : "Save Assignment"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setFormItem(null); }} className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
