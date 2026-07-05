import { getSession } from "@/lib/auth";
import { getVendors } from "@/app/actions/vendor-master";
import { VendorTable } from "@/components/vendor-master/vendor-table";

export default async function VendorMasterPage() {
  const user = await getSession();
  const canManage = !!(user && user.role === "ADMIN");
  const vendors = await getVendors();

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
            <span className="text-green-600 text-lg font-bold">{vendors.length}</span>
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Total Vendors</p>
            <p className="text-2xl font-bold text-primary mt-1">{vendors.length}</p>
          </div>
        </div>
      </div>

      <VendorTable vendors={vendors} canManage={canManage} />
    </div>
  );
}
