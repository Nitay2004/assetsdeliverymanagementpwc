"use client";

import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useAlert } from "@/hooks/use-alert";
import type { ToastVariant } from "@/hooks/use-toast";

const iconMap: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const accentMap: Record<ToastVariant, string> = {
  success: "text-green-600 dark:text-green-400",
  error: "text-red-600 dark:text-red-400",
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-amber-600 dark:text-amber-400",
};

const buttonMap: Record<ToastVariant, string> = {
  success: "bg-green-600 hover:bg-green-700 text-white",
  error: "bg-red-600 hover:bg-red-700 text-white",
  info: "bg-blue-600 hover:bg-blue-700 text-white",
  warning: "bg-amber-600 hover:bg-amber-700 text-white",
};

export function AlertDialog() {
  const { current: dialog, close } = useAlert();

  if (!dialog) return null;

  const { options, resolve: _r } = dialog;
  const variant = options.variant ?? "info";
  const Icon = iconMap[variant];
  const hasCancel = options.cancelLabel !== undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => hasCancel && close(false)}
      />
      <div
        role="alertdialog"
        className="relative z-10 w-full max-w-md rounded-2xl bg-background border shadow-2xl p-6 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-start gap-4">
          <Icon className={`size-6 shrink-0 mt-0.5 ${accentMap[variant]}`} />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{options.title}</h2>
            {options.description && (
              <p className="mt-1 text-sm text-muted-foreground">{options.description}</p>
            )}
          </div>
          {hasCancel && (
            <button
              onClick={() => close(false)}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          {hasCancel && (
            <button
              onClick={() => close(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              {options.cancelLabel ?? "Cancel"}
            </button>
          )}
          <button
            onClick={() => close(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all active:translate-y-px ${buttonMap[variant]}`}
          >
            {options.confirmLabel ?? (hasCancel ? "Confirm" : "OK")}
          </button>
        </div>
      </div>
    </div>
  );
}
