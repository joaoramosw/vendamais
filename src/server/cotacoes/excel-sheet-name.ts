/**
 * Nome de aba (worksheet) válido para Excel, a partir do título da cotação.
 *
 * O Excel recusa `* ? : \ / [ ]` em nome de aba, e o exceljs lança em vez de
 * sanitizar. O código anterior passava `titulo.slice(0, 31)` direto, então
 * **qualquer cotação com colchete ou dois-pontos no título derrubava a
 * exportação XLSX com 500** — inclusive as cotações de teste (`[TESTE] …`) e
 * qualquer título com data no formato `12/08` ou `Compra: mensal`. Bug
 * herdado do backend NestJS, não introduzido pela migração.
 *
 * Regras aplicadas (as do próprio Excel):
 *  - caracteres proibidos viram `-`;
 *  - não pode começar nem terminar com apóstrofo;
 *  - máximo de 31 caracteres;
 *  - nunca vazio.
 */
const CARACTERES_PROIBIDOS = /[*?:\\/[\]]/g;
const LIMITE_EXCEL = 31;
const PADRAO = "Cotação";

export function nomeAbaExcel(titulo: string): string {
  const limpo = (titulo ?? "")
    .replace(CARACTERES_PROIBIDOS, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITE_EXCEL)
    // O corte pode deixar um separador solto na ponta.
    .replace(/^['-]+|['-]+$/g, "")
    .trim();

  return limpo || PADRAO;
}
