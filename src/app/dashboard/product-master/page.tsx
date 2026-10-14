import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { ProductTable } from "@/components/product-master/product-table";
import { parseColumnFilters, collectBlankTokenConditions, andFilterConditions, BLANK_TOKEN } from "@/lib/column-filters";
import type { Prisma } from "@prisma/client";

const PRODUCT_FILTER_KEYS = ["make", "model", "partNo", "description", "hsnCode", "gstRate", "warranty"];

export default async function ProductMasterPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await getSession();
  requirePermission(user, "product-master", "canView");
  const canManage = !!(user && user.role === "ADMIN");

  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "25", 10) || 25));

  const filters = parseColumnFilters(searchParams, PRODUCT_FILTER_KEYS);
  const where: Prisma.ProductMasterWhereInput = {};
  // Dropdowns offer "(Blank)"; the helper turns that token into null/"" per column.
  andFilterConditions(where, collectBlankTokenConditions(
    { partNo: filters.partNo, description: filters.description, hsnCode: filters.hsnCode, warranty: filters.warranty },
    { partNo: "partNo", description: "description", hsnCode: "hsnCode", warranty: "warranty" },
  ));
  if (filters.make) where.make = { in: filters.make };
  if (filters.model) where.model = { in: filters.model };
  if (filters.gstRate?.length) {
    // The column renders "18%" while the DB stores the number 18.
    const numeric = filters.gstRate.filter(v => v !== BLANK_TOKEN).map(v => Number(v.replace("%", ""))).filter(n => !Number.isNaN(n));
    const or: Prisma.ProductMasterWhereInput[] = [];
    if (numeric.length) or.push({ gstRate: { in: numeric } });
    if (numeric.length !== filters.gstRate.length) or.push({ gstRate: null });
    if (or.length) andFilterConditions(where, [{ OR: or }]);
  }

  const [grandTotal, totalCount] = await Promise.all([
    prisma.productMaster.count(),
    prisma.productMaster.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);

  const [products, makeGroups, modelGroups, partNoGroups, descriptionGroups, hsnGroups, gstGroups, warrantyGroups] = await Promise.all([
    prisma.productMaster.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (safePage - 1) * limit,
      take: limit,
    }),
    // Dropdown values must cover the whole filtered set, not just this page.
    prisma.productMaster.groupBy({ by: ["make"], where, _count: { _all: true } }),
    prisma.productMaster.groupBy({ by: ["model"], where, _count: { _all: true } }),
    prisma.productMaster.groupBy({ by: ["partNo"], where, _count: { _all: true } }),
    prisma.productMaster.groupBy({ by: ["description"], where, _count: { _all: true } }),
    prisma.productMaster.groupBy({ by: ["hsnCode"], where, _count: { _all: true } }),
    prisma.productMaster.groupBy({ by: ["gstRate"], where, _count: { _all: true } }),
    prisma.productMaster.groupBy({ by: ["warranty"], where, _count: { _all: true } }),
  ]);

  const columnFilterValues: Record<string, { value: string; count: number }[]> = {
    make: makeGroups.map(r => ({ value: r.make ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    model: modelGroups.map(r => ({ value: r.model ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    partNo: partNoGroups.map(r => ({ value: r.partNo ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    description: descriptionGroups.map(r => ({ value: r.description ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    hsnCode: hsnGroups.map(r => ({ value: r.hsnCode ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    gstRate: gstGroups.map(r => ({ value: r.gstRate != null ? `${Number(r.gstRate)}%` : "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    warranty: warrantyGroups.map(r => ({ value: r.warranty ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
  };

  const serialized = products.map(p => ({ ...p, gstRate: p.gstRate ? Number(p.gstRate) : null }));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Product Master</h1>
        <p className="text-muted-foreground mt-2">
          Manage your product catalog — add, edit, and maintain product details.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100">
            <span className="text-blue-600 text-lg font-bold">{grandTotal}</span>
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Products</p>
            <p className="text-2xl font-bold text-primary mt-1">{grandTotal}</p>
          </div>
        </div>
      </div>

      <ProductTable
        products={serialized}
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
