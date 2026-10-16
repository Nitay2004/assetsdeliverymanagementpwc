"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, Layers } from "lucide-react";
import { QuickStat } from "./quick-stat";
import { InventoryStatusTableModal } from "@/components/inventory/inventory-status-table-modal";
import { INVENTORY_STATUS_LABELS } from "@/lib/inventory-status";

interface Props {
  newStock: number;
  availableStock: number;
  totalInventory: number;
  allocatedStock: number;
  totalAssets: number;
}

export function DashboardInventoryCards({ newStock, availableStock, totalInventory, allocatedStock, totalAssets }: Props) {
  const [modal, setModal] = useState<"PROVISION_PENDING" | "ASSET_RETURN_TO_WAREHOUSE" | null>(null);
  const router = useRouter();

  return (
    <>
      <QuickStat
        icon={<Laptop className="size-5 text-purple-600" />}
        iconBg="bg-purple-50"
        label="Provision Pending"
        value={newStock}
        subtitle="Asset in warehouse"
        onClick={() => setModal("PROVISION_PENDING")}
      />
      <QuickStat
        icon={<Laptop className="size-5 text-blue-600" />}
        iconBg="bg-blue-50"
        label="Asset Return to Warehouse"
        value={availableStock}
        subtitle={`of ${totalInventory} total`}
        onClick={() => setModal("ASSET_RETURN_TO_WAREHOUSE")}
      />
      <QuickStat
        icon={<Layers className="size-5 text-indigo-600" />}
        iconBg="bg-indigo-50"
        label="Assets Deployed to Users"
        value={allocatedStock}
        subtitle={`${totalAssets} order assets`}
        onClick={() => router.push("/dashboard/assigned-assets")}
      />

      <InventoryStatusTableModal
        open={modal === "PROVISION_PENDING"}
        onClose={() => setModal(null)}
        title={`${INVENTORY_STATUS_LABELS.PROVISION_PENDING} Laptops`}
        status="PROVISION_PENDING"
        icon={<Laptop className="size-5 text-purple-600" />}
        iconBg="bg-purple-100"
      />
      <InventoryStatusTableModal
        open={modal === "ASSET_RETURN_TO_WAREHOUSE"}
        onClose={() => setModal(null)}
        title={`${INVENTORY_STATUS_LABELS.ASSET_RETURN_TO_WAREHOUSE} Laptops`}
        status="ASSET_RETURN_TO_WAREHOUSE"
        icon={<Laptop className="size-5 text-blue-600" />}
        iconBg="bg-blue-100"
      />
    </>
  );
}
