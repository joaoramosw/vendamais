"use client";

/**
 * Acesso completo a um item da cotação — o par da página de edição completa do
 * produto, na tela de comparação: mesma dupla "acesso rápido (modal) + acesso
 * completo (página)" descrita no gotcha #22 do CLAUDE.md.
 *
 * O que a página tem a mais que o modal: espaço pra descrição inteira e os
 * atalhos pro produto do catálogo/histórico. A lista de fornecedores e o
 * cabeçalho do produto são os mesmos componentes do modal — não há uma segunda
 * versão da regra de ranking aqui.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, LineChart, RefreshCw, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DetailSkeleton } from "@/components/ui/skeletons";
import { ItemFornecedoresPanel } from "@/components/cotacoes/ItemFornecedoresPanel";
import { ItemProdutoResumo } from "@/components/cotacoes/ItemProdutoResumo";
import { identidadeFornecedor } from "@/components/cotacoes/RankingCell";
import { getProductSummary, type ProductSummary } from "@/actions/products";
import { getMargemConfig } from "@/actions/margem";
import {
  calcularValorIdeal,
  DEFAULT_MARGEM_CONFIG,
  type MargemConfig,
} from "@/lib/margem";
import { COTACAO_STATUS_LABELS } from "@/lib/constants";
import {
  getCotacaoDetalhe,
  getResultadoCotacao,
  type CotacaoItemRow,
  type CotacaoRow,
  type ItemResultado,
} from "@/lib/api/cotacoes-api";

export function ItemDetalheView({ cotacaoId, itemId }: { cotacaoId: string; itemId: string }) {
  const [loading, setLoading] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cotacao, setCotacao] = useState<CotacaoRow | null>(null);
  const [item, setItem] = useState<ItemResultado | null>(null);
  const [detalhe, setDetalhe] = useState<CotacaoItemRow | null>(null);
  const [produto, setProduto] = useState<ProductSummary | null>(null);
  const [margemConfig, setMargemConfig] = useState<MargemConfig>(DEFAULT_MARGEM_CONFIG);

  const carregar = useCallback(async () => {
    setError(null);
    try {
      const detalheCotacao = await getCotacaoDetalhe(cotacaoId);
      setCotacao(detalheCotacao.cotacao);

      const linha = detalheCotacao.itens.find((i) => i.id === itemId) ?? null;
      setDetalhe(linha);

      if (!linha) {
        setItem(null);
        setError("Item não encontrado nesta cotação.");
        return;
      }

      // O ranking só existe depois de publicada — o backend recusa (400) em
      // rascunho/cancelada, então nem chamamos.
      if (detalheCotacao.cotacao.status === "aberta" || detalheCotacao.cotacao.status === "fechada") {
        const resultado = await getResultadoCotacao(cotacaoId);
        setItem(resultado.itens.find((i) => i.cotacao_item_id === itemId) ?? null);
      } else {
        setItem(null);
      }

      if (linha.product_id) {
        const resumo = await getProductSummary(linha.product_id).catch(() => null);
        setProduto(resumo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o item.");
    }
  }, [cotacaoId, itemId]);

  useEffect(() => {
    setLoading(true);
    carregar().finally(() => setLoading(false));
  }, [carregar]);

  useEffect(() => {
    let ativo = true;
    getMargemConfig().then(({ config }) => {
      if (ativo) setMargemConfig(config);
    });
    return () => {
      ativo = false;
    };
  }, []);

  async function handleRecarregar() {
    setRecarregando(true);
    try {
      await carregar();
    } finally {
      setRecarregando(false);
    }
  }

  if (loading) return <DetailSkeleton sections={2} />;

  if (error || !cotacao) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-sm text-danger-400">{error ?? "Cotação não encontrada."}</p>
        <Link href={`/empresario/cotacoes/${cotacaoId}`}>
          <Button variant="secondary" size="sm">
            Voltar para a cotação
          </Button>
        </Link>
      </div>
    );
  }

  const valorIdeal = item
    ? calcularValorIdeal(item.preco_loja, margemConfig.margem_percent, margemConfig.metodo)
    : null;

  /** Melhor oferta do item — vai para dentro do bloco de identificação (a
   * página não tem mais um segundo bloco de números: total da compra,
   * comparação com o ideal e com o 2º colocado saíram por decisão de
   * produto). */
  const primeiro = item?.ranking[0];
  const melhorPreco = primeiro
    ? { valor: primeiro.preco_unitario, fornecedor: identidadeFornecedor(primeiro) }
    : null;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          href={`/empresario/cotacoes/${cotacaoId}`}
          className="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          title="Voltar para a cotação"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
              {detalhe?.nome_produto ?? item?.nome_produto ?? "Item"}
            </h1>
            <Badge variant="default" dot>
              {COTACAO_STATUS_LABELS[cotacao.status]}
            </Badge>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Item da cotação{" "}
            <Link
              href={`/empresario/cotacoes/${cotacaoId}`}
              className="text-primary-500 hover:underline"
            >
              {cotacao.titulo}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecarregar}
            loading={recarregando}
            disabled={recarregando}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          {detalhe?.product_id && (
            <>
              <Link href={`/empresario/produtos/editar/${detalhe.product_id}`}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" />
                  Abrir produto
                </Button>
              </Link>
              <Link href={`/empresario/produtos/editar/${detalhe.product_id}#historico`}>
                <Button variant="outline" size="sm">
                  <LineChart className="h-4 w-4" />
                  Histórico
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardBody>
          {item ? (
            <ItemProdutoResumo
              item={item}
              detalhe={detalhe}
              produto={produto}
              valorIdeal={valorIdeal}
              melhorPreco={melhorPreco}
            />
          ) : (
            <p className="text-sm text-neutral-500">
              Esta cotação ainda não foi publicada — o item aparece aqui, mas não há propostas
              possíveis até a publicação.
            </p>
          )}
        </CardBody>
      </Card>

      {item && (
        <>
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-warning-400 shrink-0" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Fornecedores deste produto
            </h2>
          </div>
          <Card>
            <CardBody>
              <ItemFornecedoresPanel
                item={item}
                cotacaoTitulo={cotacao.titulo}
                valorIdeal={valorIdeal}
                toleranciaPercent={margemConfig.tolerancia_percent}
              />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
