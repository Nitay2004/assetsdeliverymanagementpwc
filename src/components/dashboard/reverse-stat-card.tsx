"use client";

import { useState } from "react";
import { QuickStat } from "./quick-stat";
import { ReverseTableModal } from "./reverse-table-modal";
import type { ReversePickupStatus } from "@prisma/client";

interface Props {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number | string;
  subtitle?: string;
  modalTitle: string;
  modalIcon: React.ReactNode;
  modalIconBg: string;
  statuses: ReversePickupStatus[];
}

export function ReverseStatCard({ icon, iconBg, label, value, subtitle, modalTitle, modalIcon, modalIconBg, statuses }: Props) {
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
      <ReverseTableModal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle}
        icon={modalIcon}
        iconBg={modalIconBg}
        statuses={statuses}
      />
    </>
  );
}
