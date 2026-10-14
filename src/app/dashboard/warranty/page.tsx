import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Shield, CheckCircle, AlertCircle } from "lucide-react";
import { WarrantyItemTable } from "@/components/warranty/warranty-item-table";
import { parseColumnFilters, collectBlankTokenConditions, andFilterConditions } from "@/lib/column-filters";
import type { Prisma } from "@prisma/client";

// The date columns are intentionally not filterable: their distinct values are
// one-per-item, so a dropdown of them is noise. Serial / model / warranty are
// the columns people actually narrow by.
const WARRANTY_FILTER_KEYS = ["serialNumber", "model", "warrantyPeriod"];

export default async function WarrantyPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "WARRANTY"));

  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(typeof searchParams.limit === "string" ? searchParams.limit : "25", 10) || 25));
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";

  const baseWhere: Prisma.InventoryItemWhereInput = { status: { in: ["ALLOCATED", "AVAILABLE"] } };
  const filters = parseColumnFilters(searchParams, WARRANTY_FILTER_KEYS);
  const where: Prisma.InventoryItemWhereInput = { ...baseWhere };
  if (search) {
    where.OR = [
      { serialNumber: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
      { warrantyPeriod: { contains: search, mode: "insensitive" } },
    ];
  }
  if (filters.serialNumber) where.serialNumber = { in: filters.serialNumber };
  if (filters.model) where.model = { in: filters.model };
  andFilterConditions(where, collectBlankTokenConditions(
    { warrantyPeriod: filters.warrantyPeriod },
    { warrantyPeriod: "warrantyPeriod" },
  ));

  const [totalItems, totalCount, withWarranty] = await Promise.all([
    prisma.inventoryItem.count({ where: baseWhere }),
    prisma.inventoryItem.count({ where }),
    prisma.inventoryItem.count({
      where: { AND: [baseWhere, { OR: [{ warrantyPeriod: { not: null } }, { warrantyEndPeriod: { not: null } }] }] },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);

  const [items, serialGroups, modelGroups, warrantyPeriodGroups] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (safePage - 1) * limit,
      take: limit,
    }),
    prisma.inventoryItem.groupBy({ by: ["serialNumber"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["model"], where, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ["warrantyPeriod"], where, _count: { _all: true } }),
  ]);

  const columnFilterValues: Record<string, { value: string; count: number }[]> = {
    serialNumber: serialGroups.map(r => ({ value: r.serialNumber ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    model: modelGroups.map(r => ({ value: r.model ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
    warrantyPeriod: warrantyPeriodGroups.map(r => ({ value: r.warrantyPeriod ?? "(Blank)", count: r._count._all })).sort((a, b) => a.value.localeCompare(b.value)),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Warranty Module</h1>
        <p className="text-muted-foreground mt-2">
          Update hardware warranty and support information post-delivery.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100">
            <Shield className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Items</p>
            <p className="text-2xl font-bold text-primary mt-1">{totalItems}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-100">
            <CheckCircle className="size-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Warranty Set</p>
            <p className="text-2xl font-bold text-primary mt-1">{withWarranty}</p>
          </div>
        </div>
        <div className="p-5 rounded-xl glass shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-100">
            <AlertCircle className="size-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Needs Warranty</p>
            <p className="text-2xl font-bold text-primary mt-1">{totalItems - withWarranty}</p>
          </div>
        </div>
      </div>

      <WarrantyItemTable
        items={items.map(i => ({
          id: i.id,
          serialNumber: i.serialNumber,
          model: i.model,
          status: i.status,
          warrantyPeriod: i.warrantyPeriod,
          warrantyEndPeriod: i.warrantyEndPeriod,
          servicesStartDate: i.servicesStartDate,
        }))}
        canManage={canManage}
        selectedId={selectedId}
        totalCount={totalCount}
        currentPage={safePage}
        totalPages={totalPages}
        limit={limit}
        columnFilterValues={columnFilterValues}
      />
    </div>
  );
}
