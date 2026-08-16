"use client";

import type { OfertaHistorico } from "@/lib/historico-produto";
import { Badge } from "@/components/ui/badge";
import { avaliarTendencia, type MargemConfig } from "@/lib/margem";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";
import { ArrowDown, ArrowUp, ExternalLink, Minus, X } from "lucide-react";
import Link from "next/link";

interface OfertasFornecedoresCardProps {
  ofertas: OfertaHistorico[];
  valorIdeal: number | null;
  margemConfig: MargemConfig;
  /** Data do bucket em foco (hover ou fixada); `null` = ofertas mais recentes. */
  dataEmFoco: string | null;
  fixada: boolean;
  onLimparFixada: () => void;
}

function TendenciaIcone({
  valor,
  valorIdeal,
  tolerancia,
}: {
  valor: number;
  valorIdeal: number | null;
  tolerancia: number;
}) {
  const estado = avaliarTendencia(valor, valorIdeal, tolerancia);
  if (estado === "acima") {
    return <ArrowUp className="h-3.5 w-3.5 text-danger-500" aria-label="Acima do valor ideal" />;
  }
  if (estado === "abaixo") {
    return <ArrowDown className="h-3.5 w-3.5 text-success-500" aria-label="Abaixo do valor ideal" />;
  }
  if (estado === "igual") {
    return <Minus className="h-3.5 w-3.5 text-neutral-400" aria-label="Dentro do valor ideal" />;
  }
  return null;
}

export function OfertasFornecedoresCard({
  ofertas,
  valorIdeal,
  margemConfig,
  dataEmFoco,
  fixada,
  onLimparFixada,
}: OfertasFornecedoresCardProps) {
  const ordenadas = [...ofertas].sort((a, b) => a.valor - b.valor);
  const melhorValor = ordenadas[0]?.valor;

  const dataFormatada = dataEmFoco
    ? new Date(`${dataEmFoco}T00:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-800 px-5 py-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Ofertas dos fornecedores
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {dataFormatada ? `Ofertas de ${dataFormatada}` : "Veja os valores ofertados para este produto"}
          </p>
        </div>
        {fixada && (
          <button
            type="button"
            onClick={onLimparFixada}
            aria-label="Voltar às ofertas mais recentes"
            className="shrink-0 p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {ordenadas.length === 0 ? (
        <p className="py-10 text-center text-xs text-neutral-500">
          {dataFormatada
            ? "Nenhuma oferta registrada nesta data."
            : "Nenhum fornecedor cotou este produto ainda."}
        </p>
      ) : (
        // Scroll interno: com muitos fornecedores o card acompanharia a altura
        // da coluna esquerda e estouraria o alinhamento das duas colunas.
        <div className="space-y-2 overflow-y-auto max-h-[420px] -mr-1 pr-1">
          {ordenadas.map((oferta) => {
            const melhor = oferta.valor === melhorValor;
            return (
              <div
                key={oferta.id}
                className={`rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors ${
                  melhor
                    ? "border-primary-500/50 bg-primary-500/[0.06]"
                    : "border-neutral-200 dark:border-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {melhor && (
                      <Badge variant="primary" className="mb-1">
                        MELHOR PREÇO
                      </Badge>
                    )}
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate">
                      {oferta.empresa}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {formatRelativeDate(oferta.data)}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <TendenciaIcone
                      valor={oferta.valor}
                      valorIdeal={valorIdeal}
                      tolerancia={margemConfig.tolerancia_percent}
                    />
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        melhor
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-neutral-900 dark:text-neutral-100"
                      }`}
                    >
                      {formatCurrency(oferta.valor)}
                    </span>
                  </div>
                </div>

                {oferta.cotacao_id && (
                  <Link
                    href={`/empresario/cotacoes/${oferta.cotacao_id}`}
                    className={`mt-2 inline-flex items-center justify-center gap-1.5 w-full rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors ${
                      melhor
                        ? "bg-primary-500 text-white hover:bg-primary-600"
                        : "text-primary-600 dark:text-primary-400 hover:bg-primary-500/10"
                    }`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver cotação
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
