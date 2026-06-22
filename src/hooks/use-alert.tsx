"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { ToastVariant } from "./use-toast";

export interface AlertOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface AlertDialog {
  id: string;
  options: AlertOptions;
  resolve: (value: boolean) => void;
}

interface AlertContextValue {
  showAlert: (options: AlertOptions) => Promise<boolean>;
  current: AlertDialog | null;
  close: (result: boolean) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<AlertDialog | null>(null);
  const queue = useRef<AlertDialog[]>([]);

  const showNext = useCallback(() => {
    if (queue.current.length > 0) {
      setCurrent(queue.current.shift()!);
    } else {
      setCurrent(null);
    }
  }, []);

  const close = useCallback((result: boolean) => {
    const dialog = current;
    setCurrent(null);
    dialog?.resolve(result);
    showNext();
  }, [current, showNext]);

  const showAlert: (options: AlertOptions) => Promise<boolean> = useCallback((options) => {
    return new Promise<boolean>((resolve) => {
      const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: AlertDialog = { id, options, resolve };
      if (current === null) {
        setCurrent(entry);
      } else {
        queue.current.push(entry);
      }
    });
  }, [current]);

  return (
    <AlertContext.Provider value={{ showAlert, current, close }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within AlertProvider");
  return ctx;
}
