"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Shield,
  Eye,
  EyeOff,
  RotateCcw,
  UserCheck,
  UserX,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAlert } from "@/hooks/use-alert";
import {
  createUser,
  updateUserPermissions,
  deleteUser,
  toggleUserStatus,
  resetUserPermissions,
} from "@/app/actions/admin";
import {
  getDefaultPermissions,
  moduleLabels,
  type ModuleId,
  type ModulePermission,
  type Permissions,
} from "@/lib/permissions";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  permissions: unknown;
  isActive: boolean;
  createdAt: Date;
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const { toast } = useToast();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [permsUser, setPermsUser] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { email: "", name: "", password: "", role: "WAREHOUSE" };
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setForm(emptyForm);
    setShowCreate(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    fd.set("email", form.email);
    fd.set("name", form.name);
    fd.set("password", form.password);
    fd.set("role", form.role);
    const res = await createUser(fd);
    setSaving(false);
    if (!res.success) {
      toast({ title: "Error", description: res.error || "Failed to create user.", variant: "error" });
      return;
    }
    toast({ title: "User created", variant: "success" });
    setShowCreate(false);
    setForm(emptyForm);
    router.refresh();
  }

  async function handleDelete(userId: string, email: string) {
    const ok = await showAlert({
      title: "Delete User",
      description: `Are you sure you want to delete ${email}?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "error",
    });
    if (!ok) return;
    const res = await deleteUser(userId);
    if (!res.success) {
      toast({ title: "Error", description: res.error || "Failed to delete.", variant: "error" });
      return;
    }
    toast({ title: "User deleted", variant: "success" });
    router.refresh();
  }

  async function handleToggleStatus(userId: string) {
    await toggleUserStatus(userId);
    router.refresh();
  }

  async function handleResetPerms(userId: string) {
    const ok = await showAlert({
      title: "Reset Permissions",
      description: "Reset permissions to role defaults?",
      confirmLabel: "Reset",
      cancelLabel: "Cancel",
      variant: "warning",
    });
    if (!ok) return;
    await resetUserPermissions(userId);
    toast({ title: "Permissions reset", variant: "success" });
    router.refresh();
  }

  function openPerms(user: UserRow) {
    setPermsUser(user);
  }

  async function handlePermissionToggle(module: ModuleId, field: keyof ModulePermission) {
    if (!permsUser) return;
    const current = (permsUser.permissions as Permissions) || getDefaultPermissions(permsUser.role);
    const updated: Permissions = {
      ...current,
      [module]: { ...current[module], [field]: !current[module][field] },
    };
    await updateUserPermissions(permsUser.id, updated);
    setPermsUser({ ...permsUser, permissions: updated });
    toast({ title: `Permission updated`, variant: "success" });
    router.refresh();
  }

  function getPerms(user: UserRow): Permissions {
    return (user.permissions as Permissions) || getDefaultPermissions(user.role);
  }

  return (
    <>
      {/* Create Button */}
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-sm transition-all hover:bg-muted active:translate-y-press"
        >
          <Plus className="size-4" />
          Add User
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border glass">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium">{u.name || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <UserCheck className="size-3.5" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <UserX className="size-3.5" /> Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openPerms(u)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Permissions"
                    >
                      <Shield className="size-4" />
                    </button>
                    <button
                      onClick={() => handleResetPerms(u.id)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Reset permissions to role defaults"
                    >
                      <RotateCcw className="size-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u.id)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title={u.isActive ? "Deactivate" : "Activate"}
                    >
                      {u.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(u.id, u.email)}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-background border p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Create User</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="WAREHOUSE">Warehouse</option>
                  <option value="PROVISIONING">Provisioning</option>
                  <option value="FINANCE">Finance</option>
                  <option value="LOGISTICS">Logistics</option>
                  <option value="REVERSE_PICKUP">Reverse Pickup</option>
                  <option value="WARRANTY">Warranty</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create User"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {permsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-background border p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                Permissions — {permsUser.name || permsUser.email}
              </h2>
              <button onClick={() => setPermsUser(null)} className="p-1 rounded-lg hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Current role: <span className="font-semibold">{permsUser.role}</span>
            </p>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Module</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">View</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Create</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Edit</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(moduleLabels) as ModuleId[]).map((mod) => {
                    const p = getPerms(permsUser)[mod];
                    return (
                      <tr key={mod} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium capitalize">{moduleLabels[mod]}</td>
                        {(["canView", "canCreate", "canEdit", "canDelete"] as (keyof ModulePermission)[]).map(
                          (field) => (
                            <td key={field} className="px-3 py-2 text-center">
                              <button
                                onClick={() => handlePermissionToggle(mod, field)}
                                className={`size-6 rounded-md border transition-colors ${
                                  p[field]
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "bg-background border-input hover:bg-muted"
                                }`}
                              >
                                {p[field] && <span className="text-xs">✓</span>}
                              </button>
                            </td>
                          )
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
