"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, Info, Trash2 } from "lucide-react";
import { Button } from "./button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
}

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBg: "bg-danger-50 dark:bg-danger-950/40",
    iconColor: "text-danger-600 dark:text-danger-400",
    buttonVariant: "danger" as const,
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-warning-50 dark:bg-warning-950/40",
    iconColor: "text-warning-600 dark:text-warning-400",
    buttonVariant: "primary" as const,
  },
  info: {
    icon: Info,
    iconBg: "bg-primary-50 dark:bg-primary-950/40",
    iconColor: "text-primary-600 dark:text-primary-400",
    buttonVariant: "primary" as const,
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <ModalHeader onClose={onClose}>{title}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div
            className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center",
              config.iconBg
            )}
          >
            <Icon className={cn("h-7 w-7", config.iconColor)} />
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-xs">
            {description}
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={config.buttonVariant}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
