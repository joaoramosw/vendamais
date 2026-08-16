"use client";

/**
 * ItemFornecedoresPanel — todos os fornecedores que cotaram **um item**, com
 * preço, prazo e a observação que cada um escreveu para aquele produto.
 *
 * Fonte única do acesso rápido (modal) e do acesso completo (página
 * /empresario/cotacoes/[id]/itens/[itemId]) — mesma regra de ordenação, mesma
 * cor de colocação e o mesmo indicador de tendência da tabela de comparação
 * (ver RankingCell / src/lib/margem.ts). Não duplique o cálculo em nenhum dos
 * dois caminhos.
 *
 * A tabela de comparação mostra só 1º/2º/3º; aqui a lista é completa — é
 * exatamente o que o acesso rápido acrescenta.
 */

import { Info, MessageCircle, MessageSquare, PackageX, Truck } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { formatPhone, shareViaWhatsApp } from "@/lib/whatsapp";
import {
  identidadeFornecedor,
  POSICAO_LABEL,
  RANK_TEXT_CLASS,
  TendenciaIndicator,
  type Posicao,
} from "@/components/cotacoes/RankingCell";
import type { FornecedorIndisponivel, ItemResultado, RankingEntry } from "@/lib/api/cotacoes-api";

/** Fundo do badge da colocação. Só as três primeiras têm cor própria — da 4ª
 * em diante a posição é informação de ordem, não de destaque. */
const RANK_BADGE_CLASS: Record<Posicao, string> = {
  1: "bg-rank-gold/10 dark:bg-rank-gold-dark/10",
  2: "bg-rank-silver/10 dark:bg-rank-silver-dark/10",
  3: "bg-rank-bronze/10 dark:bg-rank-bronze-dark/10",
};

function ehPosicaoPremiada(posicao: number): posicao is Posicao {
  return posicao === 1 || posicao === 2 || posicao === 3;
}

function BotaoWhatsApp({
  whatsapp,
  nome,
  mensagem,
}: {
  whatsapp: string | null;
  nome: string;
  mensagem: string;
}) {
  if (!whatsapp) return null;
  return (
    <button
      type="button"
      onClick={() => shareViaWhatsApp(mensagem, whatsapp)}
      title={`Contatar ${nome} via WhatsApp (${formatPhone(whatsapp)})`}
      className="p-1.5 rounded-md text-success-600 dark:text-success-500 hover:bg-success-500/10 transition-colors cursor-pointer shrink-0"
    >
      <MessageCircle className="h-4 w-4" />
    </button>
  );
}

/** Observação do fornecedor para este item — o dado que só existe aqui: a
 * tabela de comparação não tem espaço para texto livre. */
function Observacao({ texto }: { texto: string | null }) {
  if (!texto?.trim()) return null;
  return (
    <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning-500/20 bg-warning-500/[0.06] px-2.5 py-2">
      <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning-600 dark:text-warning-400" />
      <p className="text-xs leading-relaxed text-warning-700 dark:text-warning-300 whitespace-pre-line">
        {texto}
      </p>
    </div>
  );
}

/**
 * "Observações gerais" da proposta — vale para tudo que aquele fornecedor
 * ofertou (pedido mínimo, frete, pagamento). Visual mais discreto que a
 * observação do item de propósito: aqui a pessoa está olhando **um produto**,
 * e essa nota é contexto da proposta inteira, não uma ressalva sobre o item.
 */
function ObservacaoDaProposta({ texto }: { texto: string | null }) {
  if (!texto?.trim()) return null;
  return (
    <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/[0.08] bg-neutral-50 dark:bg-white/[0.02] px-2.5 py-2">
      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-neutral-500" />
      <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Observações da proposta:{" "}
        </span>
        {texto}
      </p>
    </div>
  );
}

function FornecedorRow({
  entry,
  posicao,
  valorIdeal,
  toleranciaPercent,
  cotacaoTitulo,
  nomeProduto,
}: {
  entry: RankingEntry;
  posicao: number;
  valorIdeal: number | null;
  toleranciaPercent: number;
  cotacaoTitulo: string;
  nomeProduto: string;
}) {
  const nome = identidadeFornecedor(entry);
  const premiada = ehPosicaoPremiada(posicao);
  const corTexto = premiada ? RANK_TEXT_CLASS[posicao] : "text-neutral-700 dark:text-neutral-300";
  const corBadge = premiada ? RANK_BADGE_CLASS[posicao] : "bg-neutral-100 dark:bg-white/[0.06]";

  return (
    <li
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-3",
        posicao === 1
          ? "border-success-500/25 bg-success-500/[0.04]"
          : "border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold tabular-nums",
            corBadge,
            corTexto,
          )}
          title={premiada ? POSICAO_LABEL[posicao] : `${posicao}º colocado`}
        >
          {posicao}º
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className={cn(
                "text-sm truncate",
                corTexto,
                posicao === 1 ? "font-semibold" : "font-medium",
              )}
              title={nome}
            >
              {nome}
            </span>
            <BotaoWhatsApp
              whatsapp={entry.whatsapp}
              nome={nome}
              mensagem={`Olá! Sobre a sua proposta para "${cotacaoTitulo}", item "${nomeProduto}"...`}
            />
          </div>

          {/* Nada de subtotal aqui: a linha "Subtotal 46 × R$ 30,10 = …" foi
              removida por decisão de produto — a lista responde "quem cotou,
              por quanto e com que ressalva", não faz a conta da compra. */}
          {entry.prazo_entrega && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Truck className="h-3 w-3 shrink-0" />
              Prazo: {entry.prazo_entrega}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1">
            <span className={cn("text-base font-bold tabular-nums", corTexto)}>
              {formatCurrency(entry.preco_unitario)}
            </span>
            <TendenciaIndicator
              valorOfertado={entry.preco_unitario}
              valorIdeal={valorIdeal}
              toleranciaPercent={toleranciaPercent}
            />
          </div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">por unidade</p>
        </div>
      </div>

      <Observacao texto={entry.observacao} />
      <ObservacaoDaProposta texto={entry.observacao_proposta} />
    </li>
  );
}

function IndisponivelRow({
  fornecedor,
  cotacaoTitulo,
  nomeProduto,
}: {
  fornecedor: FornecedorIndisponivel;
  cotacaoTitulo: string;
  nomeProduto: string;
}) {
  const nome = identidadeFornecedor(fornecedor);
  return (
    <li className="rounded-[var(--radius-md)] border border-danger-500/15 bg-danger-500/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="h-8 w-8 shrink-0 rounded-full bg-danger-500/10 flex items-center justify-center">
          <PackageX className="h-4 w-4 text-danger-600 dark:text-danger-400" />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate block">
            {nome}
          </span>
          <span className="text-[11px] text-danger-600 dark:text-danger-400">
            Respondeu que não tem este produto
          </span>
        </div>
        <BotaoWhatsApp
          whatsapp={fornecedor.whatsapp}
          nome={nome}
          mensagem={`Olá! Sobre a cotação "${cotacaoTitulo}", item "${nomeProduto}"...`}
        />
      </div>
      <Observacao texto={fornecedor.observacao} />
    </li>
  );
}

export interface ItemFornecedoresPanelProps {
  item: ItemResultado;
  cotacaoTitulo: string;
  /** Valor ideal de compra do item, já calculado pelo motor de margem. */
  valorIdeal: number | null;
  toleranciaPercent: number;
}

export function ItemFornecedoresPanel({
  item,
  cotacaoTitulo,
  valorIdeal,
  toleranciaPercent,
}: ItemFornecedoresPanelProps) {
  const semNinguem = item.ranking.length === 0 && item.indisponiveis.length === 0;

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
          Fornecedores que cotaram ({item.ranking.length})
        </h3>
        {item.ranking.length === 0 ? (
          <p className="text-sm text-neutral-500 py-2">
            Nenhum fornecedor cotou este item ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {item.ranking.map((entry, idx) => (
              <FornecedorRow
                key={`${entry.proposta_id}-${entry.fornecedor_convidado_id}`}
                entry={entry}
                posicao={idx + 1}
                valorIdeal={valorIdeal}
                toleranciaPercent={toleranciaPercent}
                cotacaoTitulo={cotacaoTitulo}
                nomeProduto={item.nome_produto}
              />
            ))}
          </ul>
        )}
      </section>

      {item.indisponiveis.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            Não tem o produto ({item.indisponiveis.length})
          </h3>
          <ul className="space-y-2">
            {item.indisponiveis.map((f) => (
              <IndisponivelRow
                key={f.fornecedor_convidado_id}
                fornecedor={f}
                cotacaoTitulo={cotacaoTitulo}
                nomeProduto={item.nome_produto}
              />
            ))}
          </ul>
        </section>
      )}

      {semNinguem && (
        <p className="text-[11px] text-neutral-500 italic">
          Nenhum fornecedor respondeu sobre este item até agora.
        </p>
      )}
    </div>
  );
}
