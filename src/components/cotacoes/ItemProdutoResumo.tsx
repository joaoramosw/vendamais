"use client";

/**
 * ItemProdutoResumo — cabeçalho de identificação de um item da cotação.
 *
 * Compartilhado pelo acesso rápido (modal) e pelo acesso completo (página do
 * item): mesma imagem, mesmos números, mesma leitura de "preço loja → valor
 * ideal". `compacto` só encolhe a imagem e esconde a descrição — nenhuma
 * informação muda de significado entre os dois.
 */

import Image from "next/image";
import { Package } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { ProductSummary } from "@/actions/products";
import type { CotacaoItemRow, ItemResultado } from "@/lib/api/cotacoes-api";

function Dado({
  label,
  valor,
  hint,
  destaque = false,
}: {
  label: string;
  valor: React.ReactNode;
  /** Linha secundária (ex.: de quem é o melhor preço). */
  hint?: string;
  destaque?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={cn(
          "tabular-nums truncate",
          destaque
            ? "text-base font-bold text-success-600 dark:text-success-400"
            : "text-sm text-neutral-800 dark:text-neutral-200",
        )}
      >
        {valor}
      </p>
      {hint && (
        <p className="text-[11px] text-neutral-500 truncate" title={hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

export interface ItemProdutoResumoProps {
  item: ItemResultado;
  /** Linha de `cotacao_itens` do mesmo item — traz unidade, categoria e
   * código de barras, que o resultado por item não carrega. */
  detalhe: CotacaoItemRow | null;
  /** Produto do catálogo, quando o item veio de lá (imagem/descrição). */
  produto: ProductSummary | null;
  valorIdeal: number | null;
  compacto?: boolean;
  /**
   * Melhor oferta recebida para o item. Vive **dentro** deste bloco de
   * propósito: o painel do item tem uma faixa de dados só, não um bloco de
   * identificação e outro de números soltos. `null` quando ninguém cotou.
   */
  melhorPreco?: { valor: number; fornecedor: string } | null;
}

export function ItemProdutoResumo({
  item,
  detalhe,
  produto,
  valorIdeal,
  compacto = false,
  melhorPreco = null,
}: ItemProdutoResumoProps) {
  const imagem = produto?.image_url ?? null;
  const descricao = detalhe?.descricao ?? produto?.description ?? null;
  const categoria = detalhe?.categoria ?? produto?.category ?? null;
  const codigoBarras = detalhe?.codigo_barras ?? produto?.barcode ?? null;
  const box = compacto ? "h-16 w-16" : "h-24 w-24";

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div
          className={cn(
            "relative shrink-0 rounded-[var(--radius-md)] overflow-hidden bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/10",
            box,
          )}
        >
          {imagem ? (
            <Image
              src={imagem}
              alt={item.nome_produto}
              fill
              className="object-cover"
              sizes={compacto ? "64px" : "96px"}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className={compacto ? "h-6 w-6 text-neutral-500" : "h-8 w-8 text-neutral-500"} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "font-bold text-neutral-900 dark:text-neutral-100",
              compacto ? "text-base" : "text-lg",
            )}
          >
            {item.nome_produto}
          </h2>
          {!compacto && descricao && (
            <p className="text-sm text-neutral-500 mt-0.5 line-clamp-2">{descricao}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {detalhe?.tipo_unidade && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-info-500/10 text-info-600 dark:text-info-400">
                {detalhe.tipo_unidade}
              </span>
            )}
            {categoria && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400">
                {categoria}
              </span>
            )}
            {codigoBarras && (
              <span className="text-[10px] font-mono text-neutral-500">{codigoBarras}</span>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-3 rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/[0.06] px-3 py-2.5",
          melhorPreco ? "sm:grid-cols-5" : "sm:grid-cols-4",
        )}
      >
        {melhorPreco && (
          <Dado
            label="Melhor preço"
            valor={formatCurrency(melhorPreco.valor)}
            hint={melhorPreco.fornecedor}
            destaque
          />
        )}
        <Dado
          label="Preço loja"
          valor={item.preco_loja != null ? formatCurrency(item.preco_loja) : "—"}
        />
        <Dado
          label="Valor ideal"
          valor={valorIdeal != null ? formatCurrency(valorIdeal) : "—"}
        />
        <Dado label="Estoque" valor={item.estoque_atual ?? "—"} />
        <Dado
          label="Sugestão"
          valor={`${item.quantidade_sugerida ?? 0} ${detalhe?.unidade ?? ""}`.trim()}
        />
      </div>

      {/* A observação do comprador (escrita ao montar a cotação) é o pedido; a
          do fornecedor é a resposta — separadas de propósito. */}
      {detalhe?.observacao && (
        <p className="text-xs text-neutral-500">
          <span className="font-medium text-neutral-600 dark:text-neutral-400">
            Observação do pedido:{" "}
          </span>
          {detalhe.observacao}
        </p>
      )}
    </div>
  );
}
