import type { PropostaComItens } from "@/lib/api/propostas-api";

const PRODUTO_PREFIX = "produto:";

export const FILTRO_PADRAO = "padrao";
export const FILTRO_MELHOR_GERAL = "melhor_geral";
export const FILTRO_MENOR_VALOR = "menor_valor";
export const FILTRO_MAIS_RAPIDA = "mais_rapida";

export function filtroPorProduto(nomeProduto: string): string {
  return `${PRODUTO_PREFIX}${nomeProduto}`;
}

function produtoDoFiltro(filtro: string): string | null {
  return filtro.startsWith(PRODUTO_PREFIX) ? filtro.slice(PRODUTO_PREFIX.length) : null;
}

/** Nomes de produto distintos entre todas as propostas — pra popular o dropdown. */
export function listarProdutosDaCotacao(propostas: PropostaComItens[]): string[] {
  const nomes = new Set<string>();
  for (const p of propostas) {
    for (const item of p.itens) nomes.add(item.produto_nome);
  }
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Pra cada produto cotado por 2+ fornecedores, calcula a média de preço e
 * conta em quantos produtos cada proposta ficou abaixo da média — a
 * proposta com mais "vitórias" é a melhor cotação geral.
 *
 * Itens marcados "Não tenho" (disponivel === false) ficam de fora — o preço
 * 0 de indisponibilidade não é uma cotação real e não deve puxar a média
 * nem premiar quem não pode fornecer (mesmo critério do ranking oficial,
 * ranking-por-item.util.ts no backend).
 */
export function calcularVitorias(propostas: PropostaComItens[]): Map<string, number> {
  const porProduto = new Map<string, Array<{ propostaId: string; preco: number }>>();

  for (const p of propostas) {
    for (const item of p.itens) {
      if (item.disponivel === false) continue;
      const lista = porProduto.get(item.produto_nome) ?? [];
      lista.push({ propostaId: p.id, preco: item.preco_unitario });
      porProduto.set(item.produto_nome, lista);
    }
  }

  const vitorias = new Map<string, number>(propostas.map((p) => [p.id, 0]));

  for (const precos of porProduto.values()) {
    if (precos.length < 2) continue; // só um fornecedor cotou esse produto — sem base de comparação
    const media = precos.reduce((soma, x) => soma + x.preco, 0) / precos.length;
    for (const { propostaId, preco } of precos) {
      if (preco < media) {
        vitorias.set(propostaId, (vitorias.get(propostaId) ?? 0) + 1);
      }
    }
  }

  return vitorias;
}

export function ordenarPropostas(
  propostas: PropostaComItens[],
  filtro: string,
  vitorias: Map<string, number>,
): PropostaComItens[] {
  const arr = [...propostas];

  const produto = produtoDoFiltro(filtro);
  if (produto) {
    // Item indisponível ("Não tenho") não deve ganhar do preço real de
    // ninguém — tratado como se o fornecedor não tivesse cotado o produto.
    const precoDisponivel = (p: PropostaComItens) => {
      const i = p.itens.find((i) => i.produto_nome === produto);
      if (!i || i.disponivel === false) return Infinity;
      return i.preco_unitario;
    };
    return arr.sort((a, b) => precoDisponivel(a) - precoDisponivel(b));
  }

  switch (filtro) {
    case FILTRO_MELHOR_GERAL:
      return arr.sort((a, b) => (vitorias.get(b.id) ?? 0) - (vitorias.get(a.id) ?? 0));
    case FILTRO_MENOR_VALOR:
      return arr.sort((a, b) => a.valor_total - b.valor_total);
    case FILTRO_MAIS_RAPIDA:
      return arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    default:
      // Mais recentes primeiro — mesma convenção de ordenação usada em toda a
      // aplicação (listas de cotações, convites, etc.).
      return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}
