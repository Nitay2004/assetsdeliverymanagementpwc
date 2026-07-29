"use client";

import { useState } from "react";
import { QuickStat } from "./quick-stat";
import { OrderTableModal } from "./order-table-modal";
import type { OrderStatus } from "@prisma/client";

interface Props {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number | string;
  subtitle?: string;
  modalTitle: string;
  modalIcon: React.ReactNode;
  modalIconBg: string;
  statuses: OrderStatus[];
  inventoryTrackingKeywords?: string[];
}

export function OrderStatCard({ icon, iconBg, label, value, subtitle, modalTitle, modalIcon, modalIconBg, statuses, inventoryTrackingKeywords }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <QuickStat
        icon={icon}
        iconBg={iconBg}
        label={label}
        value={value}
        subtitle={subtitle}
        onClick={() => setOpen(true)}
      />
      <OrderTableModal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle}
        icon={modalIcon}
        iconBg={modalIconBg}
        statuses={statuses}
        inventoryTrackingKeywords={inventoryTrackingKeywords}
      />
    </>
  );
}
