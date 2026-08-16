"use client";

import { formatCents, handleCentsInput } from "@/lib/utils";
import { forwardRef } from "react";

interface PriceInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Valor em centavos inteiros (ex: 1250 = R$ 12,50) */
  cents: number;
  /** Callback chamado com o novo valor em centavos */
  onCentsChange: (cents: number) => void;
  label?: string;
  error?: string;
}

/**
 * Campo de preço estilo maquininha de cartão.
 *
 * O usuário digita de trás para frente:
 *   1 → R$ 0,01 | 10 → R$ 0,10 | 100 → R$ 1,00 | 1000 → R$ 10,00
 *
 * Internamente mantém estado em centavos (integer) para evitar problemas
 * de ponto flutuante. Use decimalToCents() ao inicializar com valor do banco
 * e centsToDecimal() ao salvar.
 */
export const PriceInput = forwardRef<HTMLInputElement, PriceInputProps>(
  ({ cents, onCentsChange, label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode="numeric"
          value={formatCents(cents)}
          onChange={(e) => onCentsChange(handleCentsInput(e.target.value))}
          className={[
            "w-full border border-neutral-200 dark:border-neutral-600",
            "rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm",
            "bg-white dark:bg-neutral-800",
            "text-neutral-800 dark:text-neutral-100",
            "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
            "focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400",
            "outline-none transition-all",
            error ? "border-danger-400 focus:ring-danger-400/20" : "",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
        )}
      </div>
    );
  }
);

PriceInput.displayName = "PriceInput";
