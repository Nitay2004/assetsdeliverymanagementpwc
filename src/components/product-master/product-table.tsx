"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import { addProduct, updateProduct, deleteProduct } from "@/app/actions/product-master";
import { useColumnFilters, ColumnFilterHeader, type ColumnFilterConfig } from "@/components/shared/column-filter";

interface Product {
  id: string;
  make: string;
  model: string;
  partNo: string | null;
  description: string | null;
  hsnCode: string | null;
  gstRate: number | null;
  warranty: string | null;
}

const PRODUCT_COLUMNS: ColumnFilterConfig<Product>[] = [
  { key: "make", getValue: r => r.make },
  { key: "model", getValue: r => r.model },
  { key: "partNo", getValue: r => r.partNo },
  { key: "description", getValue: r => r.description },
  { key: "hsnCode", getValue: r => r.hsnCode },
  { key: "gstRate", getValue: r => (r.gstRate != null ? `${r.gstRate}%` : null) },
  { key: "warranty", getValue: r => r.warranty },
];

export function ProductTable({ products, canManage }: { products: Product[]; canManage: boolean }) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { filteredRows: columnFiltered, distinctValues, filters, applyColumn, clearColumn } = useColumnFilters(PRODUCT_COLUMNS, products);
  const visibleProducts = columnFiltered;

  const emptyForm = { make: "", model: "", partNo: "", description: "", hsnCode: "", gstRate: "", warranty: "" };
  const [form, setForm] = useState(emptyForm);

  function openAddModal() {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  }

  function openEditModal(p: Product) {
    setForm({
      make: p.make,
      model: p.model,
      partNo: p.partNo ?? "",
      description: p.description ?? "",
      hsnCode: p.hsnCode ?? "",
      gstRate: p.gstRate?.toString() ?? "",
      warranty: p.warranty ?? "",
    });
    setEditingId(p.id);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.make.trim() || !form.model.trim()) {
      toast({ title: "Validation", description: "Make and Model are required.", variant: "error" });
      return;
    }

    const ok = await showAlert({
      title: editingId ? "Save changes?" : "Add product?",
      description: editingId ? "Update this product record." : "Add a new product to the catalog.",
      confirmLabel: editingId ? "Save" : "Add",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("make", form.make.trim());
      fd.set("model", form.model.trim());
      fd.set("partNo", form.partNo.trim());
      fd.set("description", form.description.trim());
      fd.set("hsnCode", form.hsnCode.trim());
      fd.set("gstRate", form.gstRate);
      fd.set("warranty", form.warranty.trim());

      if (editingId) {
        await updateProduct(editingId, fd);
        toast({ title: "Saved", description: "Product updated.", variant: "success" });
      } else {
        await addProduct(fd);
        toast({ title: "Added", description: "Product added to catalog.", variant: "success" });
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
      title: "Delete product?",
      description: `Remove "${label}" from product master?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    try {
      await deleteProduct(id);
      toast({ title: "Deleted", description: "Product removed.", variant: "success" });
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
                  label="Make"
                  values={distinctValues.make ?? []}
                  selected={Array.from(filters["make"] ?? [])}
                  onApply={(v) => applyColumn("make", v)}
                />
                <ColumnFilterHeader
                  label="Model"
                  values={distinctValues.model ?? []}
                  selected={Array.from(filters["model"] ?? [])}
                  onApply={(v) => applyColumn("model", v)}
                />
                <ColumnFilterHeader
                  label="Part No"
                  values={distinctValues.partNo ?? []}
                  selected={Array.from(filters["partNo"] ?? [])}
                  onApply={(v) => applyColumn("partNo", v)}
                />
                <ColumnFilterHeader
                  label="Description"
                  values={distinctValues.description ?? []}
                  selected={Array.from(filters["description"] ?? [])}
                  onApply={(v) => applyColumn("description", v)}
                />
                <ColumnFilterHeader
                  label="HSN Code"
                  values={distinctValues.hsnCode ?? []}
                  selected={Array.from(filters["hsnCode"] ?? [])}
                  onApply={(v) => applyColumn("hsnCode", v)}
                />
                <ColumnFilterHeader
                  label="GST Rate"
                  className="text-right"
                  values={distinctValues.gstRate ?? []}
                  selected={Array.from(filters["gstRate"] ?? [])}
                  onApply={(v) => applyColumn("gstRate", v)}
                />
                <ColumnFilterHeader
                  label="Warranty"
                  values={distinctValues.warranty ?? []}
                  selected={Array.from(filters["warranty"] ?? [])}
                  onApply={(v) => applyColumn("warranty", v)}
                />
                {canManage && <th className="px-6 py-4 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleProducts.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="px-6 py-8 text-center text-muted-foreground text-sm">
                    {products.length === 0 ? 'No products yet. Click "Add Product" to create one.' : "No products match the selected filters."}
                  </td>
                </tr>
              ) : (
                visibleProducts.map(p => (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-3 font-medium">{p.make}</td>
                    <td className="px-6 py-3">{p.model}</td>
                    <td className="px-6 py-3">{p.partNo || "—"}</td>
                    <td className="px-6 py-3 max-w-[200px] truncate">{p.description || "—"}</td>
                    <td className="px-6 py-3 font-mono text-xs">{p.hsnCode || "—"}</td>
                    <td className="px-6 py-3 text-right">{p.gstRate != null ? `${p.gstRate}%` : "—"}</td>
                    <td className="px-6 py-3">{p.warranty || "—"}</td>
                    {canManage && (
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, `${p.make} ${p.model}`)}
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
              Add Product
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
                {editingId ? "Edit Product" : "Add Product"}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="size-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Make <span className="text-destructive">*</span></label>
                  <input
                    value={form.make}
                    onChange={e => setForm(f => ({ ...f, make: e.target.value }))}
                    placeholder="e.g. HP, Dell"
                    className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Model <span className="text-destructive">*</span></label>
                  <input
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    placeholder="e.g. EliteBook 840"
                    className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Part No</label>
                <input
                  value={form.partNo}
                  onChange={e => setForm(f => ({ ...f, partNo: e.target.value }))}
                  placeholder="Part number"
                  className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Product description"
                  rows={3}
                  className="flex w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Warranty</label>
                <input
                  value={form.warranty}
                  onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))}
                  placeholder="e.g. 1 Year, 3 Years"
                  className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">HSN Code</label>
                  <input
                    value={form.hsnCode}
                    onChange={e => setForm(f => ({ ...f, hsnCode: e.target.value }))}
                    placeholder="e.g. 84713000"
                    className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">GST Rate (%)</label>
                  <input
                    value={form.gstRate}
                    onChange={e => setForm(f => ({ ...f, gstRate: e.target.value }))}
                    type="number"
                    step="0.01"
                    placeholder="e.g. 18"
                    className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-muted/20">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Product"}
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
