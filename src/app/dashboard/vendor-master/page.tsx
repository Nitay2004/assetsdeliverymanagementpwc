import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { VendorTable } from "@/components/vendor-master/vendor-table";
import { parseColumnFilters, collectBlankTokenConditions, andFilterConditions } from "@/lib/column-filters";
import type { Prisma } from "@prisma/client";

const VENDOR_FILTER_KEYS = ["grnNumber", "name", "contactPerson", "phone", "email", "gstNumber"];

export default async function VendorMasterPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await getSession();
  requirePermission(user, "vendor-master", "canView");
  const canManage = !!(user && user.role === "ADMIN");

  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "25", 10) || 25));

  const filters = parseColumnFilters(searchParams, VENDOR_FILTER_KEYS);
  const where: Prisma.VendorMasterWhereInput = {};
  // Nullable text columns go through the blank-aware helper so "(Blank)" works.
  andFilterConditions(where, collectBlankTokenConditions(
    { name: filters.name, contactPerson: filters.contactPerson, phone: filters.phone, email: filters.email, gstNumber: filters.gstNumber },
    { name: "name", contactPerson: "contactPerson", phone: "phone", email: "email", gstNumber: "gstNumber" },
  ));
  if (filters.grnNumber) where.grnNumber = { in: filters.grnNumber };

  const [grandTotal, totalCount] = await Promise.all([
    prisma.vendorMaster.count(),
    prisma.vendorMaster.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);

  const [vendors, grnGroups, nameGroups, contactGroups, phoneGroups, emailGroups, gstGroups] = await Promise.all([
    prisma.vendorMaster.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (safePage - 1) * limit,
      take: limit,
    }),
    prisma.vendorMaster.groupBy({ by: ["grnNumber"], where, _count: { _all: true } }),
    prisma.vendorMaster.groupBy({ by: ["name"], where, _count: { _all: true } }),
    prisma.vendorMaster.groupBy({ by: ["contactPerson"], where, _count: { _all: true } }),
    prisma.vendorMaster.groupBy({ by: ["phone"], where, _count: { _all: true } }),
    prisma.vendorMaster.groupBy({ by: ["email"], where, _count: { _all: true } }),
    prisma.vendorMaster.groupBy({ by: ["gstNumber"], where, _count: { _all: true } }),
  ]);

  const columnFilterValues: Record<string, { value: string; count: number }[]> = {
    grnNumber: grnGroups.map(r => ({ value: r.grnNumber ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    name: nameGroups.map(r => ({ value: r.name ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    contactPerson: contactGroups.map(r => ({ value: r.contactPerson ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    phone: phoneGroups.map(r => ({ value: r.phone ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    email: emailGroups.map(r => ({ value: r.email ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    gstNumber: gstGroups.map(r => ({ value: r.gstNumber ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Vendor Master</h1>
        <p className="text-muted-foreground mt-2">
          Manage your vendors — add, edit, and maintain vendor details. A unique GRN number is auto-generated for each vendor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-100">
            <span className="text-green-600 text-lg font-bold">{grandTotal}</span>
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Vendors</p>
            <p className="text-2xl font-bold text-primary mt-1">{grandTotal}</p>
          </div>
        </div>
      </div>

      <VendorTable
        vendors={vendors}
        canManage={canManage}
        totalCount={totalCount}
        currentPage={safePage}
        totalPages={totalPages}
        limit={limit}
        columnFilterValues={columnFilterValues}
      />
    </div>
  );
}
