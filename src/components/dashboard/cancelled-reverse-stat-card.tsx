"use client";

import { useState } from "react";
import { QuickStat } from "./quick-stat";
import { CancelledReverseModal } from "./cancelled-reverse-modal";

interface Props {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number | string;
  subtitle?: string;
  modalTitle: string;
  modalIcon: React.ReactNode;
  modalIconBg: string;
}

export function CancelledReverseStatCard({ icon, iconBg, label, value, subtitle, modalTitle, modalIcon, modalIconBg }: Props) {
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
      <CancelledReverseModal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle}
        icon={modalIcon}
        iconBg={modalIconBg}
      />
    </>
  );
}
