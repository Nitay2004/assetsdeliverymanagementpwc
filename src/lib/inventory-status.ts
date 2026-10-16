import type { InventoryStatus } from "@prisma/client";

// Display names for the inventory lifecycle. The database stores the enum label
// (Prisma enum values cannot contain spaces/dashes); the UI shows these names.
export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  PROVISION_PENDING: "Provision Pending – Asset in Warehouse",
  SHIPPED_TO_USER: "Shipped to User",
  ASSET_REDEPLOYED: "Asset Redeployed",
  ASSET_RETURN_TO_WAREHOUSE: "Asset Return to Warehouse",
  QC_PENDING: "QC Pending",
  DEFECTIVE: "Defective",
  RETIRED: "Retired",
};

export const INVENTORY_STATUS_STYLES: Record<string, string> = {
  PROVISION_PENDING: "bg-purple-100 text-purple-700",
  SHIPPED_TO_USER: "bg-blue-100 text-blue-700",
  ASSET_REDEPLOYED: "bg-indigo-100 text-indigo-700",
  ASSET_RETURN_TO_WAREHOUSE: "bg-green-100 text-green-700",
  QC_PENDING: "bg-amber-100 text-amber-700",
  DEFECTIVE: "bg-red-100 text-red-700",
  RETIRED: "bg-slate-100 text-slate-700",
};

export function inventoryStatusLabel(status: string): string {
  return INVENTORY_STATUS_LABELS[status] ?? status;
}

export function inventoryStatusStyle(status: string): string {
  return INVENTORY_STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700";
}

// An asset is "with a user" in either of these states. Queries that used to ask
// for ALLOCATED must use this list now that it is split in two.
export const DEPLOYED_STATUSES: InventoryStatus[] = ["SHIPPED_TO_USER", "ASSET_REDEPLOYED"];

export function isDeployedStatus(status: string | null | undefined): boolean {
  return status === "SHIPPED_TO_USER" || status === "ASSET_REDEPLOYED";
}

// The status to set when an asset goes out to a user: a brand-new asset's first
// deployment is "Shipped to User", anything that has been out before is a
// redeployment.
export function deployedStatus(previous: string | null | undefined): InventoryStatus {
  return previous === "PROVISION_PENDING" ? "SHIPPED_TO_USER" : "ASSET_REDEPLOYED";
}
