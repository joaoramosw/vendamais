/**
 * Observações de fornecedor num item da cotação — regra pura, usada pelo
 * desktop e pelo mobile da tela de comparação.
 *
 * "Tem observação" cobre as duas origens: quem cotou e escreveu algo junto do
 * preço (`ranking[].observacao`) e quem respondeu "não tenho" com
 * justificativa (`indisponiveis[].observacao`). As duas são texto livre do
 * fornecedor e as duas ficam escondidas atrás do acesso rápido do item — por
 * isso o ícone do produto precisa avisar que existem.
 */

import type { ItemResultado } from "@/lib/api/cotacoes-api";

/** Descarta string vazia/só espaços: observação em branco não é observação. */
function temTexto(texto: string | null | undefined): boolean {
  return !!texto && texto.trim().length > 0;
}

export function contarObservacoesDeFornecedor(item: ItemResultado): number {
  const noRanking = item.ranking.filter((entry) => temTexto(entry.observacao)).length;
  const nosIndisponiveis = item.indisponiveis.filter((f) => temTexto(f.observacao)).length;
  return noRanking + nosIndisponiveis;
}

export function temObservacaoDeFornecedor(item: ItemResultado): boolean {
  return contarObservacoesDeFornecedor(item) > 0;
}

/** Texto do `title`/tooltip — no plural certo, em pt-BR. */
export function rotuloObservacoes(total: number): string {
  if (total === 1) return "1 fornecedor deixou observação neste item";
  return `${total} fornecedores deixaram observação neste item`;
}
