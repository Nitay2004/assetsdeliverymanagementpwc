"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendToQc } from "@/app/actions/qc";
import { getDistinctFieldValues, addDropdownOption, deleteDropdownOption, seedDropdownOptions } from "@/app/actions/inventory";
import { ManageableDropdown, useDropdownData } from "@/components/inventory/manageable-dropdown";
import { PincodeInput } from "@/components/shared/pincode-input";
import { useRouter } from "next/navigation";
import { calculateCutoff } from "@/lib/cutoff-utils";
import { calculateExpectedDeliveryDate } from "@/lib/location-utils";
import { calculateSlaStatus } from "@/lib/sla-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  item: {
    id: string;
    serialNumber: string;
    model: string;
    status: string;
    invoicingWarehouse: string | null;
  } | null;
}

export function SendToQcModal({ open, onClose, item }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const { data: dropdownData, handleAddOption, handleDeleteOption } = useDropdownData();
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedPurpose, setSelectedPurpose] = useState("");
  const [selectedImageType, setSelectedImageType] = useState("");
  const [selectedAdaptor, setSelectedAdaptor] = useState("");
  const [selectedHeadset, setSelectedHeadset] = useState("");
  const [selectedSticker, setSelectedSticker] = useState("");

  if (!open || !item) return null;

  const activeItem = item;

  const entities = dropdownData?.entities ?? [];
  const purposes = dropdownData?.purposes ?? [];
  const imageTypes = dropdownData?.imageTypes ?? [];
  const allOptions = dropdownData?.allOptions ?? [];
  const adaptorAddeds = allOptions.filter(o => o.category === "adaptorAdded").map(o => o.value);
  const accessoryHeadsetMouses = allOptions.filter(o => o.category === "accessoryHeadsetMouse").map(o => o.value);
  const stickerColours = allOptions.filter(o => o.category === "stickerColour").map(o => o.value);

  /** Expected Delivery Date = SLA Start Date + Delivery TAT, unless typed over. */
  function fillExpectedDeliveryDate(form: HTMLFormElement) {
    const sla = form.querySelector<HTMLInputElement>('input[name="slaStartDate"]')?.value;
    const rawTat = form.querySelector<HTMLInputElement>('input[name="deliveryTatDays"]')?.value;
    const expectedField = form.querySelector<HTMLInputElement>('input[name="expectedDeliveryDate"]');
    if (!expectedField) return;
    const expected = calculateExpectedDeliveryDate(sla, rawTat ? parseInt(rawTat, 10) : null);
    expectedField.value = expected ?? "";
    fillSlaStatus(form);
  }

  /** SLA Missed/Met is derived from the two dates, never typed. */
  function fillSlaStatus(form: HTMLFormElement) {
    const actualField = form.querySelector<HTMLInputElement>('input[name="actualDeliveryDate"]');
    const expectedField = form.querySelector<HTMLInputElement>('input[name="expectedDeliveryDate"]');
    const slaField = form.querySelector<HTMLInputElement>('input[name="slaStatus"]');
    if (!slaField) return;
    slaField.value = calculateSlaStatus(actualField?.value ?? null, expectedField?.value ?? null);
  }

  function handleTimelineChange(e: React.FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement;
    if (target.name !== "deliveryTatDays" && target.name !== "slaStartDate") return;
    fillExpectedDeliveryDate(e.currentTarget);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      await sendToQc(activeItem.id, form);
      toast({ title: "Sent for QC", description: `${activeItem.serialNumber} queued for provisioning QC.`, variant: "success" });
      onClose();
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send for QC", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-background rounded-2xl shadow-2xl border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <ClipboardCheck className="size-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Send for QC</h2>
              <p className="text-xs text-muted-foreground">Fill user details and queue for Clean &amp; Purge QC</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-lg border p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{item.serialNumber}</p>
              <p className="text-xs text-muted-foreground">{item.model}</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              {item.status}
            </span>
          </div>

          <form key={item.id} onSubmit={handleSubmit} onChange={handleTimelineChange} className="space-y-4">
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
              <input name="emailId" type="text" placeholder="Email ID" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
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
              <p className="text-xs font-semibold text-muted-foreground mb-2">Timeline &amp; SLA</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input name="emailReceivedHour" placeholder="Email Received Hour" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" onChange={(e) => {
                  const result = calculateCutoff(e.target.value);
                  const form = e.currentTarget.closest("form");
                  if (!form) return;
                  const cutoffField = form.querySelector<HTMLInputElement>('input[name="cutOffStatus"]');
                  const slaField = form.querySelector<HTMLInputElement>('input[name="slaStartDate"]');
                  if (result) {
                    if (cutoffField) cutoffField.value = result.cutOffStatus;
                    if (slaField) slaField.value = result.slaStartDate;
                  } else {
                    if (cutoffField) cutoffField.value = "";
                  }
                  fillExpectedDeliveryDate(form);
                }} />
                <input name="cutOffStatus" placeholder="Cut Off Status" readOnly className="w-full rounded-lg border px-3 py-2 text-sm bg-background cursor-not-allowed" />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">SLA Start Date <span className="text-red-500">*</span></label>
                  <input name="slaStartDate" type="date" required readOnly className="w-full rounded-lg border px-3 py-2 text-sm bg-background cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Expected Delivery Date</label>
                  <input name="expectedDeliveryDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" onChange={(e) => fillSlaStatus(e.currentTarget.closest("form")!)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Actual Delivery Date</label>
                  <input name="actualDeliveryDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" onChange={(e) => fillSlaStatus(e.currentTarget.closest("form")!)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <input name="slaState" placeholder="State (SLA)" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                <input name="zone" placeholder="Zone" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                <input name="tier" placeholder="Tier" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <select name="odaLocation" defaultValue="No" className="w-full rounded-lg border px-3 py-2 text-sm bg-background">
                  <option value="No">ODA: No</option>
                  <option value="Yes">ODA: Yes</option>
                </select>
                <input name="tat" placeholder="TAT" required className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                <input name="deliveryTatDays" placeholder="Delivery TAT (Days)" type="number" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="slaStatus" placeholder="SLA Missed/Met" readOnly className="w-full rounded-lg border px-3 py-2 text-sm bg-background cursor-not-allowed" />
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Acceptance Date</label>
                  <input name="laptopAcceptanceDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t mt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Accessories &amp; Setup</p>
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
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
                {saving ? "Sending..." : "Send for QC"}
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
