/**
 * Molda os itens da cotação no formato exato enviado ao fornecedor via
 * GET /convite/:token — deliberadamente restrito a `id`, `nome_produto`,
 * `observacao`, `imagem_url`. Campos internos do comprador (estoque,
 * quantidade sugerida, preço manual) nunca devem passar por aqui — extraído
 * como função pura pra permitir um teste estrutural que pina essa garantia
 * (ver convite-itens.util.test.ts).
 */
export interface CotacaoItemParaConvite {
  id: string;
  nome_produto: string;
  unidade: string;
  observacao: string | null;
  product_id: string | null;
}

export interface ItemConvite {
  id: string;
  nome_produto: string;
  unidade: string;
  observacao: string | null;
  imagem_url: string | null;
}

export function montarItensConvite(
  itens: CotacaoItemParaConvite[],
  imagemPorProductId: Map<string, string | null>,
): ItemConvite[] {
  return itens
    .map((item) => ({
      id: item.id,
      nome_produto: item.nome_produto,
      unidade: item.unidade,
      observacao: item.observacao,
      imagem_url: item.product_id ? imagemPorProductId.get(item.product_id) ?? null : null,
    }))
    // Lista recebida pelo fornecedor deve estar em ordem alfabética (A-Z).
    .sort((a, b) => a.nome_produto.localeCompare(b.nome_produto, 'pt-BR'));
}
