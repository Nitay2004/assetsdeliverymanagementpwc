"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { addVendor, updateVendor, deleteVendor } from "@/app/actions/vendor-master";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig } from "@/components/shared/column-filter";

interface Vendor {
  id: string;
  grnNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contactPerson: string | null;
  gstNumber: string | null;
  isActive: boolean;
}

const VENDOR_COLUMNS: ColumnFilterConfig<Vendor>[] = [
  { key: "grnNumber", getValue: r => r.grnNumber },
  { key: "name", getValue: r => r.name },
  { key: "contactPerson", getValue: r => r.contactPerson },
  { key: "phone", getValue: r => r.phone },
  { key: "email", getValue: r => r.email },
  { key: "gstNumber", getValue: r => r.gstNumber },
];

export function VendorTable({ vendors, canManage }: { vendors: Vendor[]; canManage: boolean }) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newGrn, setNewGrn] = useState<string | null>(null);

  const { filteredRows: columnFiltered, distinctValues, filters, applyColumn, clearColumn } = useColumnFilters(VENDOR_COLUMNS, vendors);
  const visibleVendors = columnFiltered;

  const emptyForm = { name: "", email: "", phone: "", address: "", contactPerson: "", gstNumber: "" };
  const [form, setForm] = useState(emptyForm);

  function openAddModal() {
    setForm(emptyForm);
    setEditingId(null);
    setNewGrn(null);
    setShowModal(true);
  }

  function openEditModal(v: Vendor) {
    setForm({
      name: v.name,
      email: v.email ?? "",
      phone: v.phone ?? "",
      address: v.address ?? "",
      contactPerson: v.contactPerson ?? "",
      gstNumber: v.gstNumber ?? "",
    });
    setEditingId(v.id);
    setNewGrn(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setNewGrn(null);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Validation", description: "Vendor name is required.", variant: "error" });
      return;
    }

    const ok = await showAlert({
      title: editingId ? "Save changes?" : "Add vendor?",
      description: editingId ? "Update this vendor record." : "Add a new vendor to the master.",
      confirmLabel: editingId ? "Save" : "Add",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("name", form.name.trim());
      fd.set("email", form.email.trim());
      fd.set("phone", form.phone.trim());
      fd.set("address", form.address.trim());
      fd.set("contactPerson", form.contactPerson.trim());
      fd.set("gstNumber", form.gstNumber.trim());

      if (editingId) {
        await updateVendor(editingId, fd);
        toast({ title: "Saved", description: "Vendor updated.", variant: "success" });
      } else {
        const result = await addVendor(fd);
        setNewGrn(result.grnNumber);
        toast({ title: "Added", description: `Vendor added with GRN: ${result.grnNumber}`, variant: "success" });
      }
      closeModal();
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, label: string) {
    const ok = await showAlert({
      title: "Delete vendor?",
      description: `Remove "${label}" from vendor master?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    try {
      await deleteVendor(id);
      toast({ title: "Deleted", description: "Vendor removed.", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "error" });
    }
  }

  return (
    <>
      <div className="rounded-xl glass shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
              <tr>
                <ColumnFilterHeader
                  label="GRN No"
                  values={distinctValues.grnNumber ?? []}
                  selected={Array.from(filters["grnNumber"] ?? [])}
                  onApply={(v) => applyColumn("grnNumber", v)}
                />
                <ColumnFilterHeader
                  label="Vendor Name"
                  values={distinctValues.name ?? []}
                  selected={Array.from(filters["name"] ?? [])}
                  onApply={(v) => applyColumn("name", v)}
                />
                <ColumnFilterHeader
                  label="Contact Person"
                  values={distinctValues.contactPerson ?? []}
                  selected={Array.from(filters["contactPerson"] ?? [])}
                  onApply={(v) => applyColumn("contactPerson", v)}
                />
                <ColumnFilterHeader
                  label="Phone"
                  values={distinctValues.phone ?? []}
                  selected={Array.from(filters["phone"] ?? [])}
                  onApply={(v) => applyColumn("phone", v)}
                />
                <ColumnFilterHeader
                  label="Email"
                  values={distinctValues.email ?? []}
                  selected={Array.from(filters["email"] ?? [])}
                  onApply={(v) => applyColumn("email", v)}
                />
                <ColumnFilterHeader
                  label="GST No"
                  values={distinctValues.gstNumber ?? []}
                  selected={Array.from(filters["gstNumber"] ?? [])}
                  onApply={(v) => applyColumn("gstNumber", v)}
                />
                {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleVendors.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="px-6 py-8 text-center text-muted-foreground text-sm">
                    {vendors.length === 0 ? 'No vendors yet. Click "Add Vendor" to create one.' : "No vendors match the selected filters."}
                  </td>
                </tr>
              ) : (
                visibleVendors.map(v => (
                  <tr key={v.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs font-medium">{v.grnNumber}</td>
                    <td className="px-6 py-3 font-medium">{v.name}</td>
                    <td className="px-6 py-3">{v.contactPerson || "—"}</td>
                    <td className="px-6 py-3">{v.phone || "—"}</td>
                    <td className="px-6 py-3">{v.email || "—"}</td>
                    <td className="px-6 py-3 font-mono text-xs">{v.gstNumber || "—"}</td>
                    {canManage && (
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(v)}
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(v.id, v.name)}
                            className="p-1.5 rounded-md text-destructive hover:bg-destructive/10"
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {canManage && !showModal && (
          <div className="px-6 py-3 border-t">
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="size-4" />
              Add Vendor
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={closeModal} />
          <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-lg mx-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">
                {editingId ? "Edit Vendor" : "Add Vendor"}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="size-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Vendor Name <span className="text-destructive">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Tech Solutions Pvt Ltd"
                  className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Contact Person</label>
                  <input
                    value={form.contactPerson}
                    onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}
                    placeholder="e.g. Rajesh Sharma"
                    className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="e.g. +91-9876543210"
                    className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email</label>
                <input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="e.g. contact@vendor.com"
                  type="email"
                  className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Address</label>
                <textarea
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Vendor address"
                  rows={3}
                  className="flex w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">GST Number</label>
                <input
                  value={form.gstNumber}
                  onChange={e => setForm(f => ({ ...f, gstNumber: e.target.value }))}
                  placeholder="e.g. 27AAACR1234A1Z5"
                  className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-muted/20">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Vendor"}
              </button>
              <button
                onClick={closeModal}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
