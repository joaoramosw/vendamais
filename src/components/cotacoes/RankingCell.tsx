"use client";

/**
 * RankingCell — conteúdo de uma colocação (1º/2º/3º) na comparação de cotações.
 *
 * Fonte única do desktop (célula de tabela) e do mobile (card colapsável):
 * mesma cor de colocação, mesmo indicador de tendência, mesmo cálculo de
 * valor ideal (`src/lib/margem.ts`). Duplicar isso nos dois caminhos foi o
 * que a especificação pediu pra evitar explicitamente.
 */

import { ArrowDown, ArrowUp, Equal, MessageCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { abreviarNomeEmpresa } from "@/lib/nome-empresa";
import { avaliarTendencia, diferencaPercentual, type TendenciaEstado } from "@/lib/margem";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import type { RankingEntry } from "@/lib/api/cotacoes-api";

export type Posicao = 1 | 2 | 3;

/** Ouro / prata / bronze — tokens do tema (globals.css), nunca hex inline.
 * O par claro/escuro é obrigatório: o tom que passa contraste no fundo claro
 * é ilegível no escuro e vice-versa. */
export const RANK_TEXT_CLASS: Record<Posicao, string> = {
  1: "text-rank-gold dark:text-rank-gold-dark",
  2: "text-rank-silver dark:text-rank-silver-dark",
  3: "text-rank-bronze dark:text-rank-bronze-dark",
};

export const POSICAO_LABEL: Record<Posicao, string> = {
  1: "1º colocado",
  2: "2º colocado",
  3: "3º colocado",
};

export function identidadeFornecedor(entry: {
  nome_empresa: string | null;
  email_contato: string | null;
}): string {
  return entry.nome_empresa || entry.email_contato || "Fornecedor";
}

/* ─── Indicador de tendência ────────────────────────────────────────────── */

const TENDENCIA_CLASS: Record<TendenciaEstado, string> = {
  acima: "text-trend-up dark:text-trend-up-dark",
  igual: "text-trend-equal dark:text-trend-equal-dark",
  abaixo: "text-trend-down dark:text-trend-down-dark",
};

function textoTendencia(
  estado: TendenciaEstado,
  valorIdeal: number,
  diferenca: number | null,
): string {
  const ideal = `valor ideal ${formatCurrency(valorIdeal)}`;
  const delta = diferenca == null ? "" : ` (${diferenca > 0 ? "+" : ""}${diferenca}%)`;
  if (estado === "acima") return `Acima do ${ideal}${delta} — fora da margem`;
  if (estado === "abaixo") return `Abaixo do ${ideal}${delta} — dentro da margem`;
  return `No ${ideal} — dentro da tolerância`;
}

/**
 * Seta/sinal ao lado do valor ofertado.
 *
 * Polaridade invertida de propósito: subir de preço é ruim (vermelho), descer
 * é bom (verde). Quem decide o estado é `avaliarTendencia` — aqui só pinta.
 */
export function TendenciaIndicator({
  valorOfertado,
  valorIdeal,
  toleranciaPercent,
  className,
}: {
  valorOfertado: number | null | undefined;
  valorIdeal: number | null;
  toleranciaPercent: number;
  className?: string;
}) {
  const estado = avaliarTendencia(valorOfertado, valorIdeal, toleranciaPercent);
  if (!estado || valorIdeal == null) return null;

  const diferenca = diferencaPercentual(valorOfertado, valorIdeal);
  const titulo = textoTendencia(estado, valorIdeal, diferenca);

  return (
    // Sem `title`: o corpo da tabela deixou de ter tooltip (a explicação das
    // setas mora no tooltip do cabeçalho da coluna "Preço loja"). O
    // `aria-label` fica — é nome acessível, não balão de ajuda.
    <span
      role="img"
      className={cn("inline-flex items-center shrink-0", TENDENCIA_CLASS[estado], className)}
      aria-label={titulo}
    >
      {estado === "acima" && <ArrowUp className="h-3.5 w-3.5" aria-hidden />}
      {estado === "abaixo" && <ArrowDown className="h-3.5 w-3.5" aria-hidden />}
      {estado === "igual" && (
        <>
          <Equal className="h-3.5 w-3.5" aria-hidden />
          <ArrowDown className="h-3 w-3 -ml-0.5" aria-hidden />
        </>
      )}
    </span>
  );
}

/* ─── Conteúdo da colocação ─────────────────────────────────────────────── */

function WhatsAppButton({ entry, cotacaoTitulo }: { entry: RankingEntry; cotacaoTitulo: string }) {
  if (!entry.whatsapp) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        // A linha inteira é clicável no mobile (expande/colapsa) — sem isso,
        // contatar o fornecedor também abriria/fecharia o card.
        e.stopPropagation();
        shareViaWhatsApp(`Olá! Sobre a sua proposta para "${cotacaoTitulo}"...`, entry.whatsapp);
      }}
      title={`Contatar ${identidadeFornecedor(entry)} via WhatsApp`}
      className="p-1 rounded-md text-success-600 dark:text-success-500 hover:bg-success-500/10 transition-colors cursor-pointer shrink-0"
    >
      <MessageCircle className="h-3.5 w-3.5" />
    </button>
  );
}

export interface ColocadoProps {
  entry: RankingEntry | undefined;
  posicao: Posicao;
  cotacaoTitulo: string;
  /** Valor ideal de compra do item (mesmo para as três colocações — cada
   * fornecedor é avaliado individualmente contra ele). */
  valorIdeal: number | null;
  toleranciaPercent: number;
  /** Mostra "1º colocado" acima do nome — usado só no mobile, onde não há
   * cabeçalho de coluna pra dizer de qual posição é o bloco. */
  comRotulo?: boolean;
}

export function ColocadoConteudo({
  entry,
  posicao,
  cotacaoTitulo,
  valorIdeal,
  toleranciaPercent,
  comRotulo = false,
}: ColocadoProps) {
  const corRank = RANK_TEXT_CLASS[posicao];

  if (!entry) {
    return (
      <div className="min-w-0">
        {comRotulo && (
          <p className={cn("text-[11px] font-medium", corRank)}>{POSICAO_LABEL[posicao]}</p>
        )}
        <span className="text-sm text-neutral-500">—</span>
      </div>
    );
  }

  const nomeCompleto = identidadeFornecedor(entry);

  return (
    <div className="min-w-0">
      {comRotulo && (
        <p className={cn("text-[11px] font-medium", corRank)}>{POSICAO_LABEL[posicao]}</p>
      )}
      <div className="flex items-center gap-1 min-w-0">
        <span
          className={cn("text-sm truncate", corRank, posicao === 1 && "font-semibold")}
          title={nomeCompleto}
        >
          {abreviarNomeEmpresa(nomeCompleto)}
        </span>
        <WhatsAppButton entry={entry} cotacaoTitulo={cotacaoTitulo} />
      </div>
      <div className="flex items-center gap-1 min-w-0">
        <span className={cn("text-sm tabular-nums", corRank, posicao === 1 && "font-semibold")}>
          {formatCurrency(entry.preco_unitario)}
        </span>
        <TendenciaIndicator
          valorOfertado={entry.preco_unitario}
          valorIdeal={valorIdeal}
          toleranciaPercent={toleranciaPercent}
        />
      </div>
    </div>
  );
}
