"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, Layers } from "lucide-react";
import { QuickStat } from "./quick-stat";
import { InventoryStatusTableModal } from "@/components/inventory/inventory-status-table-modal";

interface Props {
  newStock: number;
  newStockByWarehouse: [string, number][];
  newStockNoWarehouse: number;
  availableStock: number;
  availableByWarehouse: [string, number][];
  availableNoWarehouse: number;
  totalInventory: number;
  allocatedStock: number;
  totalAssets: number;
}

export function DashboardInventoryCards({
  newStock,
  newStockByWarehouse,
  newStockNoWarehouse,
  availableStock,
  availableByWarehouse,
  availableNoWarehouse,
  totalInventory,
  allocatedStock,
  totalAssets,
}: Props) {
  const [modal, setModal] = useState<"PROVISION_PENDING" | "ASSET_RETURN_TO_WAREHOUSE" | null>(null);
  const router = useRouter();

  return (
    <>
      <QuickStat
        icon={<Laptop className="size-5 text-purple-600" />}
        iconBg="bg-purple-50"
        label="New Assets"
        value={newStock}
        subtitle="Asset in warehouse"
        breakdown={newStockByWarehouse}
        breakdownNoWarehouse={newStockNoWarehouse}
        onClick={() => setModal("PROVISION_PENDING")}
      />
      <QuickStat
        icon={<Laptop className="size-5 text-blue-600" />}
        iconBg="bg-blue-50"
        label="Asset Available for Deployment"
        value={availableStock}
        subtitle={`of ${totalInventory} total`}
        breakdown={availableByWarehouse}
        breakdownNoWarehouse={availableNoWarehouse}
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
        title="New Assets Laptops"
        status="PROVISION_PENDING"
        icon={<Laptop className="size-5 text-purple-600" />}
        iconBg="bg-purple-100"
      />
      <InventoryStatusTableModal
        open={modal === "ASSET_RETURN_TO_WAREHOUSE"}
        onClose={() => setModal(null)}
        title="Asset Available for Deployment Laptops"
        status="ASSET_RETURN_TO_WAREHOUSE"
        icon={<Laptop className="size-5 text-blue-600" />}
        iconBg="bg-blue-100"
      />
    </>
  );
}
