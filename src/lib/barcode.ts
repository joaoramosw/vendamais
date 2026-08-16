/**
 * Normaliza um valor de código de barras: remove espaços (inclusive
 * internos, tabs e quebras de linha que scanners às vezes injetam) e trima
 * as pontas. Nunca converte pra número — zeros à esquerda e formatos
 * alfanuméricos precisam ser preservados como string (ver
 * products.barcode / cotacao_itens.codigo_barras).
 */
export function normalizeBarcode(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

/**
 * Heurística pra distinguir "isso parece um código de barras" de "isso é
 * uma busca por nome". Aceita numérico e alfanumérico (mín. 6 caracteres) —
 * só nas pontas, sem tirar espaço interno: um nome de produto com espaço
 * ("Arroz branco") não pode virar "Arrozbranco" e passar como código.
 */
export function looksLikeBarcode(raw: string): boolean {
  return /^[a-zA-Z0-9]{6,}$/.test(raw.trim());
}
