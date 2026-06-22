import { getSession } from "@/lib/auth";
import { getProducts } from "@/app/actions/product-master";
import { ProductTable } from "@/components/product-master/product-table";

export default async function ProductMasterPage() {
  const user = await getSession();
  const canManage = !!(user && user.role === "ADMIN");
  const products = await getProducts();

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
            <span className="text-blue-600 text-lg font-bold">{products.length}</span>
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Products</p>
            <p className="text-2xl font-bold text-primary mt-1">{products.length}</p>
          </div>
        </div>
      </div>

      <ProductTable products={products} canManage={canManage} />
    </div>
  );
}
