import { CotacaoItemRow } from '../cotacoes/cotacoes.types';
import { PropostaItemRow } from './propostas.types';

/**
 * Uma cotação de preço, dentro do ranking de um item específico — quem
 * cotou, por quanto, e quando (pra desempate).
 */
export interface RankingEntry {
  proposta_id: string;
  fornecedor_convidado_id: string;
  nome_empresa: string | null;
  email_contato: string | null;
  whatsapp: string | null;
  preco_unitario: number;
  created_at: string;
  /** Observação que o fornecedor escreveu **para este item** (não para a
   * proposta inteira) — é o que a tela de acesso rápido/detalhe do item
   * mostra ao lado do preço. `null` quando ele não escreveu nada. */
  observacao: string | null;
  /** Prazo de entrega da proposta a que esta oferta pertence — vale pra
   * proposta toda, mas é repetido por entrada porque o consumidor olha o
   * item, não a proposta. */
  prazo_entrega: string | null;
  /** "Observações gerais" da proposta (`propostas.observacao`) — mesmo caso do
   * prazo: vale pra proposta inteira e é repetida por entrada. `null` também
   * quando a migration 023 ainda não rodou. */
  observacao_proposta: string | null;
}

/** Fornecedor que respondeu "Não tenho" pra esse item — fica de fora do
 * ranking, mas precisa aparecer em algum lugar pra distinguir de "não cotou". */
export interface FornecedorIndisponivel {
  fornecedor_convidado_id: string;
  nome_empresa: string | null;
  email_contato: string | null;
  whatsapp: string | null;
  /** "Não tenho" também aceita justificativa ("volta dia 20", "só na caixa
   * fechada") — sem isso a informação se perde na tela. */
  observacao: string | null;
}

export interface ItemResultado {
  cotacao_item_id: string;
  nome_produto: string;
  quantidade: number;
  quantidade_sugerida: number | null;
  estoque_atual: number | null;
  preco_unitario_manual: number | null;
  preco_manual: boolean;
  /**
   * Preço praticado na loja (`products.price_unit_store`), resolvido pelo
   * `product_id` do item. É a base do "valor ideal de compra" exibido na
   * tabela de comparação (ver src/lib/margem.ts). `null` quando o item não
   * veio do catálogo ou o produto está sem preço cadastrado — a UI precisa
   * distinguir isso de "preço zero".
   */
  preco_loja: number | null;
  /** Ordenado por preço crescente — ranking[0] é o vencedor (menor preço). */
  ranking: RankingEntry[];
  /** Fornecedores convidados que responderam "Não tenho" para este item. */
  indisponiveis: FornecedorIndisponivel[];
}

/** Preço de loja só existe pra item vindo do catálogo, e `price_unit_store`
 * usa 0 como "sem preço cadastrado" (default da coluna) — os dois casos viram
 * `null`, que é o que a UI trata como "sem base pro valor ideal". */
function resolverPrecoLoja(
  productId: string | null,
  precoLojaPorProduto: ReadonlyMap<string, number>,
): number | null {
  if (!productId) return null;
  const preco = precoLojaPorProduto.get(productId);
  return preco != null && preco > 0 ? preco : null;
}

export interface PropostaParaRanking {
  id: string;
  fornecedor_convidado_id: string;
  nome_empresa: string | null;
  email_contato: string | null;
  whatsapp: string | null;
  prazo_entrega: string | null;
  /** `propostas.observacao` — ausente enquanto a migration 023 não rodar. */
  observacao?: string | null;
  created_at: string;
  itens: PropostaItemRow[];
}

/**
 * Ranking por item — fonte única de verdade (ver plano da sessão, seção 9).
 * Consumida pela tela de resultado, pelo filtro por fornecedor e pela
 * impressão/exportação, todos sobre o mesmo cálculo.
 *
 * Critério de vitória: menor preço por item (decisão confirmada nesta
 * sessão — NÃO é a heurística "abaixo da média" de propostas-filters.ts,
 * que serve a um propósito diferente, de acompanhamento antes do
 * encerramento). Empate de preço é desempatado por quem enviou a proposta
 * primeiro (created_at mais antigo) — decisão confirmada.
 *
 * Casamento de item da cotação com item da proposta é por nome_produto
 * (produto_nome do lado da proposta) — proposta_itens não tem FK pra
 * cotacao_itens no schema real (ver CLAUDE.md).
 *
 * Itens marcados como "não tenho" (disponivel === false) não entram no
 * ranking — preço 0 de indisponibilidade não é uma cotação real e não deve
 * competir por 1º/2º/3º lugar. Ficam listados separadamente em
 * `indisponiveis`, pra distinguir "respondeu que não tem" de "não cotou".
 */
export function calcularRankingPorItem(
  itens: CotacaoItemRow[],
  propostas: PropostaParaRanking[],
  /** product_id -> preço de loja. Opcional: quem só quer o ranking (ex.:
   * testes) não precisa carregar o catálogo. */
  precoLojaPorProduto: ReadonlyMap<string, number> = new Map(),
): ItemResultado[] {
  return itens.map((item) => {
    const entradas: RankingEntry[] = [];
    const indisponiveis: FornecedorIndisponivel[] = [];

    for (const proposta of propostas) {
      const itemProposta = proposta.itens.find((pi) => pi.produto_nome === item.nome_produto);
      if (!itemProposta) continue;

      if (itemProposta.disponivel === false) {
        indisponiveis.push({
          fornecedor_convidado_id: proposta.fornecedor_convidado_id,
          nome_empresa: proposta.nome_empresa,
          email_contato: proposta.email_contato,
          whatsapp: proposta.whatsapp,
          observacao: itemProposta.observacao,
        });
        continue;
      }

      entradas.push({
        proposta_id: proposta.id,
        fornecedor_convidado_id: proposta.fornecedor_convidado_id,
        nome_empresa: proposta.nome_empresa,
        email_contato: proposta.email_contato,
        whatsapp: proposta.whatsapp,
        preco_unitario: itemProposta.preco_unitario,
        created_at: proposta.created_at,
        observacao: itemProposta.observacao,
        prazo_entrega: proposta.prazo_entrega,
        observacao_proposta: proposta.observacao ?? null,
      });
    }

    entradas.sort((a, b) => {
      if (a.preco_unitario !== b.preco_unitario) return a.preco_unitario - b.preco_unitario;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return {
      cotacao_item_id: item.id,
      nome_produto: item.nome_produto,
      quantidade: item.quantidade,
      quantidade_sugerida: item.quantidade_sugerida,
      estoque_atual: item.estoque_atual,
      preco_unitario_manual: item.preco_unitario_manual,
      preco_manual: item.preco_manual,
      preco_loja: resolverPrecoLoja(item.product_id, precoLojaPorProduto),
      ranking: entradas,
      indisponiveis,
    };
  });
}
