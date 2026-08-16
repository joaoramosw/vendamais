"use client";

import { PriceInput } from "@/components/ui/price-input";
import { calcularPrecoVenda, type MargemConfig } from "@/lib/margem";
import { centsToDecimal, decimalToCents, formatCurrency } from "@/lib/utils";
import { Calculator, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface SimuladorPrecoVendaProps {
  /** Melhor oferta atual — pré-preenche o custo. */
  custoInicial: number | null;
  precoLojaAtual: number | null;
  margemConfig: MargemConfig;
}

/** Espera a digitação parar antes de recalcular — evita recalcular a cada
 * tecla enquanto o usuário ainda está montando o número. */
function useDebounced<T>(valor: T, ms = 250): T {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return debounced;
}

export function SimuladorPrecoVenda({
  custoInicial,
  precoLojaAtual,
  margemConfig,
}: SimuladorPrecoVendaProps) {
  const [custoCents, setCustoCents] = useState(() => decimalToCents(custoInicial ?? 0));
  const [margemInput, setMargemInput] = useState(String(margemConfig.margem_percent));

  // Quando a melhor oferta muda (troca de período/data), o campo acompanha —
  // mas só se o usuário ainda não mexeu nele.
  const [tocado, setTocado] = useState(false);
  useEffect(() => {
    if (!tocado) setCustoCents(decimalToCents(custoInicial ?? 0));
  }, [custoInicial, tocado]);

  const custoDebounced = useDebounced(custoCents);
  const margemDebounced = useDebounced(margemInput);

  const margemNumero = Number(margemDebounced.replace(",", "."));
  const margemValida = Number.isFinite(margemNumero) && margemNumero >= 0 && margemNumero < 1000;
  const margemAlterada = margemValida && margemNumero !== margemConfig.margem_percent;

  const custo = centsToDecimal(custoDebounced);

  const precoVenda = useMemo(
    () =>
      margemValida ? calcularPrecoVenda(custo, margemNumero, margemConfig.metodo) : null,
    [custo, margemNumero, margemValida, margemConfig.metodo],
  );

  const lucro = precoVenda != null ? precoVenda - custo : null;

  const comparativo = useMemo(() => {
    if (precoVenda == null || precoLojaAtual == null || precoLojaAtual <= 0) return null;
    const diff = precoVenda - precoLojaAtual;
    const pct = (diff / precoLojaAtual) * 100;
    if (Math.abs(pct) < 0.5) return { estado: "alinhado" as const, pct: 0 };
    return { estado: diff > 0 ? ("acima" as const) : ("abaixo" as const), pct };
  }, [precoVenda, precoLojaAtual]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-800 px-5 py-4">
      <div className="flex items-start gap-3 mb-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
          <Calculator className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Simulador de preço de venda
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Por quanto vender este produto partindo de um custo de compra.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entradas */}
        <div className="space-y-1.5">
          <label
            htmlFor="sim-custo"
            className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
          >
            Custo de compra
          </label>
          <PriceInput
            id="sim-custo"
            cents={custoCents}
            onCentsChange={(c) => {
              setTocado(true);
              setCustoCents(c);
            }}
            placeholder="R$ 0,00"
            className="min-h-[44px]"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="sim-margem"
            className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
          >
            Margem (%)
          </label>
          <input
            id="sim-margem"
            type="text"
            inputMode="decimal"
            value={margemInput}
            onChange={(e) => setMargemInput(e.target.value)}
            aria-invalid={!margemValida}
            className={`w-full min-h-[44px] border rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 outline-none transition-all focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 ${
              margemValida
                ? "border-neutral-200 dark:border-white/10"
                : "border-danger-500/40 focus:ring-danger-500/20"
            }`}
          />
          <p className="text-[11px] text-neutral-500">
            {margemAlterada ? (
              <span className="text-warning-600 dark:text-warning-400">
                Simulação — não altera a margem padrão.
              </span>
            ) : (
              <>Padrão do Markup ({margemConfig.margem_percent}%).</>
            )}
          </p>
        </div>

        {/* Saídas */}
        <div className="rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/[0.06] bg-neutral-50 dark:bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Preço de venda sugerido
          </p>
          <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1 tabular-nums">
            {precoVenda != null ? formatCurrency(precoVenda) : "—"}
          </p>
          {comparativo && (
            <p
              className={`text-[11px] mt-1 ${
                comparativo.estado === "acima"
                  ? "text-danger-600 dark:text-danger-400"
                  : comparativo.estado === "abaixo"
                    ? "text-success-600 dark:text-success-400"
                    : "text-neutral-500"
              }`}
            >
              {comparativo.estado === "alinhado"
                ? "Alinhado com o preço de loja"
                : `${Math.abs(comparativo.pct).toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}% ${comparativo.estado} do preço de loja`}
            </p>
          )}
        </div>

        <div className="rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/[0.06] bg-neutral-50 dark:bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Lucro bruto por unidade
          </p>
          <p className="text-xl font-bold text-success-600 dark:text-success-400 mt-1 tabular-nums">
            {lucro != null ? formatCurrency(lucro) : "—"}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">Preço de venda menos o custo.</p>
        </div>
      </div>

      <Link
        href="/empresario/ajustes"
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Alterar a margem padrão em Markup
      </Link>
    </div>
  );
}
