"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer focus-ring disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white shadow-sm",
        secondary:
          "bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-600 active:bg-neutral-100 dark:active:bg-neutral-500 text-neutral-700 dark:text-neutral-200 shadow-xs",
        ghost:
          "hover:bg-neutral-100 dark:hover:bg-neutral-700 active:bg-neutral-200 dark:active:bg-neutral-600 text-neutral-600 dark:text-neutral-300",
        /**
         * Botão contornado SEM cor própria — fundo, texto e borda vêm inteiros
         * de quem usa. Existe justamente para botões temáticos (ações
         * coloridas): com `secondary`, cada cor precisava vencer 8 classes
         * padrão (`dark:text-neutral-200`, `dark:border-neutral-600`,
         * `active:bg-neutral-*`…) via tailwind-merge, e qualquer propriedade
         * esquecida vazava cinza. Aqui não há o que sobrescrever.
         */
        outline: "bg-transparent border shadow-xs",
        danger:
          "bg-danger hover:bg-danger-600 active:bg-danger-700 text-white shadow-sm",
        success:
          "bg-success hover:bg-success-600 active:bg-success-700 text-white shadow-sm",
        link:
          "text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "text-sm px-3 py-1.5 rounded-[var(--radius-sm)]",
        md: "text-sm px-4 py-2.5 rounded-[var(--radius-md)]",
        lg: "text-base px-6 py-3 rounded-[var(--radius-md)]",
        icon: "p-2.5 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, loadingText, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
