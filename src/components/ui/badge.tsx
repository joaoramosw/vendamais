import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";

const badgeVariants = cva(
  "inline-flex items-center gap-1 font-medium rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300",
        rascunho: "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300",
        enviada: "bg-info-50 dark:bg-info-950/40 text-info-700 dark:text-info-300",
        "em-analise": "bg-warning-50 dark:bg-warning-950/40 text-warning-700 dark:text-warning-300",
        aceita: "bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-300",
        recusada: "bg-danger-50 dark:bg-danger-950/40 text-danger-700 dark:text-danger-300",
        expirada: "bg-neutral-50 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500",
        primary: "bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300",
        success: "bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-300",
        warning: "bg-warning-50 dark:bg-warning-950/40 text-warning-700 dark:text-warning-300",
        danger: "bg-danger-50 dark:bg-danger-950/40 text-danger-700 dark:text-danger-300",
        info: "bg-info-50 dark:bg-info-950/40 text-info-700 dark:text-info-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, dot, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {children}
    </span>
  )
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
