"use client";

import {
  avaliarTendencia,
  diferencaPercentual,
  type MargemConfig,
  type TendenciaEstado,
} from "@/lib/margem";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface MargemStatusBannerProps {
  melhorOferta: number | null;
  valorIdeal: number | null;
  precoLojaAtual: number | null;
  margemConfig: MargemConfig;
  periodoLabel: string;
}

const ROTULO: Record<TendenciaEstado, string> = {
  abaixo: "ABAIXO",
  igual: "DENTRO",
  acima: "ACIMA",
};

const COR_STATUS: Record<TendenciaEstado, string> = {
  abaixo: "text-success-600 dark:text-success-400",
  igual: "text-neutral-700 dark:text-neutral-200",
  acima: "text-danger-600 dark:text-danger-400",
};

/**
 * Converte um valor em posição percentual na barra.
 *
 * A escala é ancorada no valor ideal (sempre no meio) e vai de −40% a +40% em
 * torno dele. Isso mantém o marcador "Valor ideal" fixo no centro, que é o que
 * torna a barra legível: a leitura passa a ser "quanto o melhor preço está pra
 * esquerda (bom) ou pra direita (ruim) do ideal", e não uma escala absoluta
 * que mudaria de significado a cada produto.
 */
function posicaoNaBarra(valor: number, ideal: number): number {
  const desvio = (valor - ideal) / ideal;
  const clamped = Math.max(-0.4, Math.min(0.4, desvio));
  return 50 + (clamped / 0.4) * 50;
}

export function MargemStatusBanner({
  melhorOferta,
  valorIdeal,
  precoLojaAtual,
  margemConfig,
  periodoLabel,
}: MargemStatusBannerProps) {
  const estado = avaliarTendencia(melhorOferta, valorIdeal, margemConfig.tolerancia_percent);
  const diferenca = diferencaPercentual(melhorOferta, valorIdeal);

  if (precoLojaAtual == null) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-warning-500/20 bg-warning-50 dark:bg-warning-500/[0.07] px-5 py-4">
        <p className="text-sm font-medium text-warning-700 dark:text-warning-300">
          Este produto não tem preço de loja definido
        </p>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
          Sem ele não dá para calcular o valor ideal de compra. Informe o preço de loja acima para
          liberar a leitura de margem.
        </p>
      </div>
    );
  }

  if (estado == null || melhorOferta == null || valorIdeal == null) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-800 px-5 py-4">
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Ainda sem ofertas para comparar
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          O valor ideal de compra é {formatCurrency(valorIdeal ?? 0)} (margem de{" "}
          {margemConfig.margem_percent}%). Assim que houver uma oferta, a leitura aparece aqui.
        </p>
      </div>
    );
  }

  const posIdeal = 50;
  const posOferta = posicaoNaBarra(melhorOferta, valorIdeal);
  // Marcadores colados viram um borrão — quando isso acontece (estado "igual"),
  // o de baixo é empurrado o mínimo para os dois continuarem legíveis.
  const sobrepostos = Math.abs(posOferta - posIdeal) < 6;

  return (
    <div className="rounded-[var(--radius-lg)] border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-800 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
          <TrendingUp className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            O melhor preço ofertado está{" "}
            <span className={COR_STATUS[estado]}>{ROTULO[estado]}</span> da margem ideal
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
            Com base nos últimos <strong className="text-neutral-700 dark:text-neutral-300">{periodoLabel}</strong>, o
            melhor preço ofertado está{" "}
            <strong className={COR_STATUS[estado]}>
              {Math.abs(diferenca ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </strong>{" "}
            {(diferenca ?? 0) >= 0 ? "acima" : "abaixo"} do valor ideal de compra de{" "}
            <strong className="text-neutral-700 dark:text-neutral-300">
              {formatCurrency(valorIdeal)}
            </strong>
            .
          </p>
        </div>
      </div>

      {/* Gauge */}
      <div className="mt-6 pb-1">
        <div className="relative">
          {/* Marcador de cima — valor ideal */}
          <div
            className="absolute -top-5 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${posIdeal}%` }}
          >
            <span className="text-[10px] sm:text-[11px] font-medium text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
              Valor ideal
            </span>
            <span className="mt-0.5 h-0 w-0 border-x-4 border-x-transparent border-t-[6px] border-t-neutral-500 dark:border-t-neutral-300" />
          </div>

          <div className="h-2 w-full rounded-full bg-gradient-to-r from-success-500 via-warning-400 to-danger-500" />

          {/* Marcador de baixo — melhor oferta */}
          <div
            className="absolute top-2 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${posOferta}%` }}
          >
            <span className="h-0 w-0 border-x-4 border-x-transparent border-b-[6px] border-b-primary-500" />
            <span
              className={`mt-0.5 text-[10px] sm:text-[11px] font-semibold text-primary-500 whitespace-nowrap ${
                sobrepostos ? "translate-y-1" : ""
              }`}
            >
              Melhor oferta
            </span>
          </div>
        </div>
        <div className="mt-8 flex justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
          <span>mais barato</span>
          <span>mais caro</span>
        </div>
      </div>
    </div>
  );
}
