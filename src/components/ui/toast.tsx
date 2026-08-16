"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

const toastConfig: Record<
  ToastType,
  { icon: typeof CheckCircle; bg: string; border: string; text: string }
> = {
  success: {
    icon: CheckCircle,
    bg: "bg-success-50 dark:bg-success-950/80",
    border: "border-success-200 dark:border-success-800",
    text: "text-success-800 dark:text-success-200",
  },
  error: {
    icon: XCircle,
    bg: "bg-danger-50 dark:bg-danger-950/80",
    border: "border-danger-200 dark:border-danger-800",
    text: "text-danger-800 dark:text-danger-200",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-warning-50 dark:bg-warning-950/80",
    border: "border-warning-200 dark:border-warning-800",
    text: "text-warning-800 dark:text-warning-200",
  },
  info: {
    icon: Info,
    bg: "bg-info-50 dark:bg-info-950/80",
    border: "border-info-200 dark:border-info-800",
    text: "text-info-800 dark:text-info-200",
  },
};

// Global toast state
let toastListeners: ((toast: ToastData) => void)[] = [];

export function showToast(message: string, type: ToastType = "success") {
  const toast: ToastData = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    message,
    type,
  };
  toastListeners.forEach((listener) => listener(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4000);
  }, []);

  useEffect(() => {
    toastListeners.push(addToast);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== addToast);
    };
  }, [addToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const config = toastConfig[toast.type];
        const Icon = config.icon;
        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] border shadow-lg animate-slide-in",
              config.bg,
              config.border
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0", config.text)} />
            <p className={cn("text-sm font-medium flex-1", config.text)}>
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className={cn(
                "shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer",
                config.text
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
