"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, Layers } from "lucide-react";
import { QuickStat } from "./quick-stat";
import { InventoryStatusTableModal } from "@/components/inventory/inventory-status-table-modal";

interface Props {
  newStock: number;
  availableStock: number;
  totalInventory: number;
  allocatedStock: number;
  totalAssets: number;
}

export function DashboardInventoryCards({ newStock, availableStock, totalInventory, allocatedStock, totalAssets }: Props) {
  const [modal, setModal] = useState<"NEW" | "AVAILABLE" | null>(null);
  const router = useRouter();

  return (
    <>
      <QuickStat
        icon={<Laptop className="size-5 text-purple-600" />}
        iconBg="bg-purple-50"
        label="New Stock"
        value={newStock}
        subtitle="Brand new laptops"
        onClick={() => setModal("NEW")}
      />
      <QuickStat
        icon={<Laptop className="size-5 text-blue-600" />}
        iconBg="bg-blue-50"
        label="Re-deployment Inventory"
        value={availableStock}
        subtitle={`of ${totalInventory} total`}
        onClick={() => setModal("AVAILABLE")}
      />
      <QuickStat
        icon={<Layers className="size-5 text-indigo-600" />}
        iconBg="bg-indigo-50"
        label="Assets Allocated to Users"
        value={allocatedStock}
        subtitle={`${totalAssets} order assets`}
        onClick={() => router.push("/dashboard/assigned-assets")}
      />

      <InventoryStatusTableModal
        open={modal === "NEW"}
        onClose={() => setModal(null)}
        title="New Stock Laptops"
        status="NEW"
        icon={<Laptop className="size-5 text-purple-600" />}
        iconBg="bg-purple-100"
      />
      <InventoryStatusTableModal
        open={modal === "AVAILABLE"}
        onClose={() => setModal(null)}
        title="Re-deployment Laptops"
        status="AVAILABLE"
        icon={<Laptop className="size-5 text-blue-600" />}
        iconBg="bg-blue-100"
      />
    </>
  );
}
