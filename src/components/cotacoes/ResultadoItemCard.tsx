"use client";

/**
 * ResultadoItemCard — a linha da comparação de cotações no mobile.
 *
 * Abaixo de `md` a tabela deixa de ser tabela: três colunas de colocação
 * (nome + valor + indicador) não cabem numa tela estreita, e scroll
 * horizontal esconde justamente a informação que interessa comparar. Vira
 * uma lista de cards colapsáveis — fechado mostra o essencial (produto,
 * preço de loja e 1º colocado), aberto revela 2º e 3º. Nada é perdido, só
 * realocado entre os dois estados.
 *
 * Cores, abreviação e indicador vêm de `RankingCell` — os mesmos do
 * desktop, sem divergência visual entre as duas renderizações.
 */

import Link from "next/link";
import { ChevronRight, ExternalLink, Search } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { contarObservacoesDeFornecedor } from "@/lib/cotacao-observacoes";
import { ColocadoConteudo, identidadeFornecedor } from "@/components/cotacoes/RankingCell";
import { ProdutoItemIcone } from "@/components/cotacoes/ProdutoItemIcone";
import type { ItemResultado } from "@/lib/api/cotacoes-api";

interface ResultadoItemCardProps {
  item: ItemResultado;
  cotacaoTitulo: string;
  /** Valor ideal de compra já calculado pelo motor de margem (mesma função
   * pura usada no desktop) — `null` quando o produto não tem preço de loja. */
  valorIdeal: number | null;
  toleranciaPercent: number;
  /** Margem configurada (Ajustes) — só para explicar de onde sai o preço
   * ideal de compra no texto do card aberto. Nunca hardcode 28,5% aqui. */
  margemPercent: number;
  expandido: boolean;
  onToggle: () => void;
  /** Espelha o filtro "Ver apenas o 1º colocado" do desktop. */
  apenasPrimeiroColocado: boolean;
  mostrarQuantidadeEstoque: boolean;
  /** Abre o acesso rápido do item (modal) — par do clique no nome do produto
   * no desktop. No mobile o toque na linha já é o expandir/colapsar, então o
   * acesso rápido ganha um botão próprio dentro do card aberto. */
  onAcessoRapido: () => void;
  /** Acesso completo — página do item. */
  hrefDetalhe: string;
}

export function ResultadoItemCard({
  item,
  cotacaoTitulo,
  valorIdeal,
  toleranciaPercent,
  margemPercent,
  expandido,
  onToggle,
  apenasPrimeiroColocado,
  mostrarQuantidadeEstoque,
  onAcessoRapido,
  hrefDetalhe,
}: ResultadoItemCardProps) {
  const [primeiro, segundo, terceiro] = item.ranking;
  const precoLoja = item.preco_loja;

  return (
    <div className="border-b border-neutral-200 dark:border-white/[0.06] last:border-0">
      {/* A linha inteira é o alvo de toque (não só o chevron); min-h-[44px]
          é o alvo mínimo recomendado pra dedo. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expandido}
        className="w-full min-h-[44px] flex items-start gap-3 px-4 py-3 text-left cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <ProdutoItemIcone totalObservacoes={contarObservacoesDeFornecedor(item)} />
            <span className="font-medium text-sm text-neutral-800 dark:text-neutral-200 truncate">
              {item.nome_produto}
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 pl-[22px]">
            <span className="text-[11px] text-neutral-500">Preço loja</span>
            <span className="text-sm tabular-nums text-neutral-700 dark:text-neutral-300">
              {precoLoja != null ? formatCurrency(precoLoja) : "—"}
            </span>
          </div>

          <div className="pl-[22px]">
            <ColocadoConteudo
              entry={primeiro}
              posicao={1}
              cotacaoTitulo={cotacaoTitulo}
              valorIdeal={valorIdeal}
              toleranciaPercent={toleranciaPercent}
              comRotulo
            />
          </div>
        </div>

        <ChevronRight
          className={cn(
            "h-4 w-4 text-neutral-500 shrink-0 mt-1 transition-transform duration-200",
            expandido && "rotate-90",
          )}
          aria-hidden
        />
      </button>

      {expandido && (
        <div className="px-4 pb-4 pl-[42px] space-y-3 animate-fade-in">
          {/* Referência de cálculo — continua visível com o card aberto, é o
              número contra o qual cada indicador foi decidido. */}
          <div className="text-[11px] text-neutral-500">
            <p>
              Preço ideal de compra:{" "}
              <span className="tabular-nums text-neutral-700 dark:text-neutral-300">
                {valorIdeal != null ? formatCurrency(valorIdeal) : "—"}
              </span>
              {valorIdeal == null && " (produto sem preço de loja cadastrado)"}
            </p>
            {/* No mobile não há hover, então a explicação que no desktop mora
                no tooltip da coluna "Preço loja" fica escrita aqui. */}
            <p className="mt-0.5 text-neutral-600 dark:text-neutral-500">
              {valorIdeal != null
                ? `Máximo a pagar ao fornecedor para manter sua margem de ${margemPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% sobre o preço de loja.`
                : "Sem preço de loja cadastrado não dá para calcular quanto pagar ao fornecedor."}
            </p>
          </div>

          {!apenasPrimeiroColocado && (
            <div className="grid grid-cols-2 gap-3">
              <ColocadoConteudo
                entry={segundo}
                posicao={2}
                cotacaoTitulo={cotacaoTitulo}
                valorIdeal={valorIdeal}
                toleranciaPercent={toleranciaPercent}
                comRotulo
              />
              <ColocadoConteudo
                entry={terceiro}
                posicao={3}
                cotacaoTitulo={cotacaoTitulo}
                valorIdeal={valorIdeal}
                toleranciaPercent={toleranciaPercent}
                comRotulo
              />
            </div>
          )}

          {mostrarQuantidadeEstoque && (
            /* Sugestão é só leitura aqui — mesma decisão do desktop: no
               resultado ela é a quantidade que multiplica o preço ofertado,
               não um campo de trabalho. */
            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <span>Estoque: {item.estoque_atual ?? "—"}</span>
              <span className="tabular-nums">Sugestão: {item.quantidade_sugerida ?? "—"}</span>
            </div>
          )}

          {item.indisponiveis.length > 0 && (
            <p className="text-[11px] text-neutral-500 italic">
              Não tem: {item.indisponiveis.map((f) => identidadeFornecedor(f)).join(", ")}
            </p>
          )}

          {/* Acesso rápido e acesso completo — os mesmos dois caminhos do
              desktop (nome do produto / ícone ao lado), aqui como botões
              próprios porque o toque na linha já expande o card. */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onAcessoRapido}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              Fornecedores e observações
            </button>
            <Link
              href={hrefDetalhe}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary-500 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Detalhe completo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
