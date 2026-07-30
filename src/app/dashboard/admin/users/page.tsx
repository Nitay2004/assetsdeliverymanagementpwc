import { getSession } from "@/lib/auth";
import { getUsers } from "@/app/actions/admin";
import { UsersTable } from "@/components/admin/users-table";

export default async function AdminUsersPage() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return <div className="text-center py-20 text-muted-foreground">Access denied.</div>;
  }

  const users = await getUsers();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Create, edit, and manage users. Assign roles and configure module-level permissions.
        </p>
      </div>

      <UsersTable users={users} />
    </div>
  );
}
