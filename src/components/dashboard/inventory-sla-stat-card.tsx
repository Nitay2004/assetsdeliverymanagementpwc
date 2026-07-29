"use client";

import { useState } from "react";
import { QuickStat } from "./quick-stat";
import { InventorySlaModal } from "./inventory-sla-modal";

interface Props {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number | string;
  subtitle?: string;
  modalTitle: string;
  modalIcon: React.ReactNode;
  modalIconBg: string;
  slaValue: string;
}

export function InventorySlaStatCard({ icon, iconBg, label, value, subtitle, modalTitle, modalIcon, modalIconBg, slaValue }: Props) {
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
      <InventorySlaModal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle}
        icon={modalIcon}
        iconBg={modalIconBg}
        slaValue={slaValue}
      />
    </>
  );
}
