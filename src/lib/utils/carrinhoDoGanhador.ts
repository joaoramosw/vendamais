// =====================================================================
// src/lib/utils/carrinhoDoGanhador.ts
//
// Lógica do "Carrinho do Ganhador" — Negociação em Bloco
//
// COMO USAR no componente React:
//
//  const { selecionados, toggleItem, gerarOrdensDeCompra } = useCarrinhoGanhador();
//
//  // Na tabela de comparação item x item, o empresário marca os ganhadores:
//  <input
//    type="checkbox"
//    checked={selecionados.some(s => s.itemId === item.id && s.propostaId === proposta.id)}
//    onChange={() => toggleItem({ itemId: item.id, propostaId: proposta.id, fornecedorNome: ..., ... })}
//  />
//
//  // Ao clicar em "Gerar Ordens":
//  const ordens = gerarOrdensDeCompra(selecionados);
//  // ordens é um array de { fornecedor, itens[], totalFornecedor }
// =====================================================================

"use client";
import { useState, useCallback } from "react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Um único item que o empresário selecionou do "cardápio" de propostas */
export interface ItemSelecionado {
  /** ID do cotacao_item (produto solicitado) */
  cotacaoItemId: string;
  /** ID da proposta do fornecedor escolhido para este item */
  propostaId: string;
  /** ID do fornecedor_convidado — chave para agrupamento */
  fornecedorConvidadoId: string;
  /** Nome legível para a UI */
  fornecedorNome: string;
  telefone?: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  prazoEntrega?: string;
}

/** Resultado final: uma ordem de compra por fornecedor */
export interface OrdemDeCompra {
  fornecedorConvidadoId: string;
  fornecedorNome: string;
  telefone?: string;
  prazoEntrega?: string;
  itens: Array<{
    cotacaoItemId: string;
    produtoNome: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
  }>;
  totalFornecedor: number;
}

// ─── Função Pura: Consolidar → separar por fornecedor ────────────────────────

/**
 * Recebe a lista de itens selecionados pelo empresário e retorna um array
 * de Ordens de Compra, uma por fornecedor, com os subtotais calculados.
 */
export function gerarOrdensDeCompra(
  selecionados: ItemSelecionado[]
): OrdemDeCompra[] {
  if (!selecionados.length) return [];

  // Agrupa pelo ID do fornecedor usando um Map para performance O(n)
  const ordemMap = new Map<string, OrdemDeCompra>();

  for (const item of selecionados) {
    const subtotal = item.quantidade * item.precoUnitario;

    if (!ordemMap.has(item.fornecedorConvidadoId)) {
      ordemMap.set(item.fornecedorConvidadoId, {
        fornecedorConvidadoId: item.fornecedorConvidadoId,
        fornecedorNome: item.fornecedorNome,
        telefone: item.telefone,
        prazoEntrega: item.prazoEntrega,
        itens: [],
        totalFornecedor: 0,
      });
    }

    const ordem = ordemMap.get(item.fornecedorConvidadoId)!;
    ordem.itens.push({
      cotacaoItemId: item.cotacaoItemId,
      produtoNome: item.produtoNome,
      quantidade: item.quantidade,
      precoUnitario: item.precoUnitario,
      subtotal,
    });
    ordem.totalFornecedor += subtotal;
  }

  // Arredondamento final de centavos por ordem
  const ordens = Array.from(ordemMap.values()).map((o) => ({
    ...o,
    totalFornecedor: Math.round(o.totalFornecedor * 100) / 100,
  }));

  // Ordena as ordens pelo maior volume financeiro (compra principal primeiro)
  return ordens.sort((a, b) => b.totalFornecedor - a.totalFornecedor);
}

// ─── Hook React: estado de seleção do carrinho ────────────────────────────────

/**
 * Hook para gerenciar o estado do Carrinho do Ganhador na UI.
 * Garante que cada `cotacaoItemId` esteja selecionado de uma única proposta
 * (se o usuário mudar de fornecedor para o mesmo item, o anterior é removido).
 */
export function useCarrinhoGanhador() {
  const [selecionados, setSelecionados] = useState<ItemSelecionado[]>([]);

  const toggleItem = useCallback((item: ItemSelecionado) => {
    setSelecionados((prev) => {
      // Verifica se já existe este item da MESMA proposta no carrinho
      const jaExiste = prev.some(
        (s) =>
          s.cotacaoItemId === item.cotacaoItemId &&
          s.propostaId === item.propostaId
      );

      if (jaExiste) {
        // Desmarca: remove do carrinho
        return prev.filter(
          (s) =>
            !(
              s.cotacaoItemId === item.cotacaoItemId &&
              s.propostaId === item.propostaId
            )
        );
      }

      // Se o item existe mas de outro fornecedor, substitui (um item = um fornecedor)
      const semEsteItem = prev.filter(
        (s) => s.cotacaoItemId !== item.cotacaoItemId
      );

      return [...semEsteItem, item];
    });
  }, []);

  const isSelecionado = useCallback(
    (cotacaoItemId: string, propostaId: string) =>
      selecionados.some(
        (s) => s.cotacaoItemId === cotacaoItemId && s.propostaId === propostaId
      ),
    [selecionados]
  );

  const limparCarrinho = useCallback(() => setSelecionados([]), []);

  const totalGeral = selecionados.reduce(
    (acc, s) => acc + s.quantidade * s.precoUnitario,
    0
  );

  return {
    selecionados,
    totalGeral: Math.round(totalGeral * 100) / 100,
    toggleItem,
    isSelecionado,
    limparCarrinho,
    gerarOrdensDeCompra: () => gerarOrdensDeCompra(selecionados),
  };
}
