import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Shield, CheckCircle, AlertCircle } from "lucide-react";
import { WarrantyItemTable } from "@/components/warranty/warranty-item-table";
import { ScrollToItem } from "@/components/shared/scroll-to-item";

export default async function WarrantyPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const selectedId = typeof searchParams.selected === "string" ? searchParams.selected : undefined;
  const user = await getSession();
  const canManage = !!(user && (user.role === "ADMIN" || user.role === "WARRANTY"));

  const items = await prisma.inventoryItem.findMany({
    where: {
      status: { in: ["ALLOCATED", "AVAILABLE"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  const withWarranty = items.filter(i => i.warrantyPeriod || i.warrantyEndPeriod).length;

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
            <p className="text-2xl font-bold text-primary mt-1">{items.length}</p>
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
            <p className="text-2xl font-bold text-primary mt-1">{items.length - withWarranty}</p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-8 rounded-xl glass text-center text-muted-foreground">
          No inventory items found.
        </div>
      ) : (
        <WarrantyItemTable items={items} canManage={canManage} selectedId={selectedId} />
      )}
    </div>
  );
}
