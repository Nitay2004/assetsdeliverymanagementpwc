"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, ShieldCheck, Laptop, Database, ClipboardCheck } from "lucide-react";
import { InventoryStatusTableModal } from "./inventory-status-table-modal";

interface Props {
  totalCount: number;
  newCount: number;
  availableCount: number;
  qcPendingCount: number;
  allocatedCount: number;
}

const CARD_BASE = "p-6 rounded-xl glass shadow-sm flex flex-col gap-2";

export function InventoryStatCards({ totalCount, newCount, availableCount, qcPendingCount, allocatedCount }: Props) {
  const [modal, setModal] = useState<"NEW" | "AVAILABLE" | "QC_PENDING" | null>(null);
  const router = useRouter();

  const card = (icon: React.ReactNode, label: string, value: number, colorClass: string, onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`${CARD_BASE} text-left ${onClick ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group" : "cursor-default"}`}
    >
      <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
        {icon}
        {label}
        {onClick && <span className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-primary transition-opacity">View →</span>}
      </div>
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
    </button>
  );

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-5 mt-8">
        {card(<Package className="size-4" />, "Total Stock", totalCount, "text-primary")}
        {card(<Database className="size-4" />, "New", newCount, "text-purple-600", () => setModal("NEW"))}
        {card(<ShieldCheck className="size-4" />, "Available", availableCount, "text-primary", () => setModal("AVAILABLE"))}
        {card(<ClipboardCheck className="size-4" />, "QC Pending", qcPendingCount, "text-amber-600", () => setModal("QC_PENDING"))}
        {card(<Laptop className="size-4" />, "Allocated", allocatedCount, "text-primary", () => router.push("/dashboard/assigned-assets"))}
      </div>

      <InventoryStatusTableModal
        open={modal === "NEW"}
        onClose={() => setModal(null)}
        title="New Laptops"
        status="NEW"
        icon={<Database className="size-5 text-purple-600" />}
        iconBg="bg-purple-100"
      />
      <InventoryStatusTableModal
        open={modal === "AVAILABLE"}
        onClose={() => setModal(null)}
        title="Available Laptops"
        status="AVAILABLE"
        icon={<ShieldCheck className="size-5 text-primary" />}
        iconBg="bg-blue-100"
      />
      <InventoryStatusTableModal
        open={modal === "QC_PENDING"}
        onClose={() => setModal(null)}
        title="QC Pending Laptops"
        status="QC_PENDING"
        icon={<ClipboardCheck className="size-5 text-amber-600" />}
        iconBg="bg-amber-100"
      />
    </>
  );
}
