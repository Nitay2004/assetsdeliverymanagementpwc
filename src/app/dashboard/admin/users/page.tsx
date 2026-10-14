import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersTable } from "@/components/admin/users-table";
import { parseColumnFilters, collectBlankTokenConditions, andFilterConditions } from "@/lib/column-filters";
import type { Prisma, UserRole } from "@prisma/client";

const USERS_FILTER_KEYS = ["name", "email", "role", "status"];

export default async function AdminUsersPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return <div className="text-center py-20 text-muted-foreground">Access denied.</div>;
  }

  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "25", 10) || 25));

  const filters = parseColumnFilters(searchParams, USERS_FILTER_KEYS);
  const where: Prisma.UserWhereInput = {};
  andFilterConditions(where, collectBlankTokenConditions({ name: filters.name }, { name: "name" }));
  if (filters.email) where.email = { in: filters.email };
  if (filters.role?.length) where.role = { in: filters.role as UserRole[] };
  if (filters.status?.length) {
    // "status" is a derived column mapped back onto isActive. Selecting both
    // values is the same as selecting none, so it adds no restriction.
    const active = filters.status.includes("Active");
    const inactive = filters.status.includes("Inactive");
    if (active && !inactive) where.isActive = true;
    else if (inactive && !active) where.isActive = false;
  }

  const [grandTotal, totalCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);

  const [users, nameGroups, emailGroups, roleGroups, activeCount, inactiveCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (safePage - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    }),
    // Dropdowns must span every filtered row, not just the visible page.
    prisma.user.groupBy({ by: ["name"], where, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["email"], where, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["role"], where, _count: { _all: true } }),
    prisma.user.count({ where: { AND: [where, { isActive: true }] } }),
    prisma.user.count({ where: { AND: [where, { isActive: false }] } }),
  ]);

  const statusValues: { value: string; count: number }[] = [];
  if (activeCount > 0) statusValues.push({ value: "Active", count: activeCount });
  if (inactiveCount > 0) statusValues.push({ value: "Inactive", count: inactiveCount });

  const columnFilterValues: Record<string, { value: string; count: number }[]> = {
    name: nameGroups.map(r => ({ value: r.name ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    email: emailGroups.map(r => ({ value: r.email, count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    role: roleGroups.map(r => ({ value: r.role, count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    status: statusValues,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Create, edit, and manage users. Assign roles and configure module-level permissions.
        </p>
      </div>

      <UsersTable
        users={users}
        totalCount={totalCount}
        grandTotal={grandTotal}
        currentPage={safePage}
        totalPages={totalPages}
        limit={limit}
        columnFilterValues={columnFilterValues}
      />
    </div>
  );
}
