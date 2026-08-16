"use client";

/**
 * Acesso rápido ao item da cotação — espelha o `ProductQuickViewModal` da tela
 * de produtos: os dados principais num modal, sem perder o contexto da tabela
 * de comparação, e um link pro acesso completo no rodapé.
 *
 * O que ele acrescenta à tabela: a lista **completa** de fornecedores (a
 * tabela só mostra 1º/2º/3º) e a observação que cada um escreveu para este
 * produto — texto livre que não cabe numa célula.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { ItemFornecedoresPanel } from "@/components/cotacoes/ItemFornecedoresPanel";
import { ItemProdutoResumo } from "@/components/cotacoes/ItemProdutoResumo";
import { identidadeFornecedor } from "@/components/cotacoes/RankingCell";
import { getProductSummary, type ProductSummary } from "@/actions/products";
import type { CotacaoItemRow, ItemResultado } from "@/lib/api/cotacoes-api";

interface ItemQuickViewModalProps {
  /** `null` fecha o modal — mesmo contrato do acesso rápido de produtos. */
  item: ItemResultado | null;
  detalhe: CotacaoItemRow | null;
  cotacaoId: string;
  cotacaoTitulo: string;
  valorIdeal: number | null;
  toleranciaPercent: number;
  onClose: () => void;
}

export function ItemQuickViewModal({
  item,
  detalhe,
  cotacaoId,
  cotacaoTitulo,
  valorIdeal,
  toleranciaPercent,
  onClose,
}: ItemQuickViewModalProps) {
  const [produto, setProduto] = useState<ProductSummary | null>(null);
  const productId = detalhe?.product_id ?? null;

  // Imagem/descrição do catálogo são um extra: o item já traz tudo que a tela
  // precisa pra funcionar, então a falha aqui é silenciosa de propósito.
  useEffect(() => {
    setProduto(null);
    if (!productId) return;
    let ativo = true;
    getProductSummary(productId)
      .then((p) => {
        if (ativo) setProduto(p);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [productId]);

  if (!item) return null;

  const primeiro = item.ranking[0];
  const melhorPreco = primeiro
    ? { valor: primeiro.preco_unitario, fornecedor: identidadeFornecedor(primeiro) }
    : null;

  return (
    <Modal open onClose={onClose} className="max-w-2xl">
      <ModalHeader onClose={onClose}>Acesso rápido ao item</ModalHeader>
      <ModalBody className="space-y-5 max-h-[70vh] overflow-y-auto">
        <ItemProdutoResumo
          item={item}
          detalhe={detalhe}
          produto={produto}
          valorIdeal={valorIdeal}
          melhorPreco={melhorPreco}
          compacto
        />
        <ItemFornecedoresPanel
          item={item}
          cotacaoTitulo={cotacaoTitulo}
          valorIdeal={valorIdeal}
          toleranciaPercent={toleranciaPercent}
        />
      </ModalBody>
      <ModalFooter className="justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/empresario/cotacoes/${cotacaoId}/itens/${item.cotacao_item_id}`}>
            <Button variant="ghost" size="sm" type="button">
              <ExternalLink className="h-4 w-4" />
              Abrir detalhe completo
            </Button>
          </Link>
          {productId && (
            <Link href={`/empresario/produtos/editar/${productId}`}>
              <Button variant="ghost" size="sm" type="button">
                <PackageSearch className="h-4 w-4" />
                Ver produto
              </Button>
            </Link>
          )}
        </div>
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
