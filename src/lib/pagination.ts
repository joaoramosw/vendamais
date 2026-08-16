/** Tamanhos de lote oferecidos no seletor "itens por página". */
export const PER_PAGE_OPTIONS = [20, 50, 100, 200] as const;

export const DEFAULT_PER_PAGE = 50;

/** Chave usada pra lembrar a escolha do usuário entre visitas. */
export const PER_PAGE_STORAGE_KEY = "vendamais:produtos:perPage";

/**
 * Valida o `perPage` que veio da URL. Fora da lista (ou lixo) cai no padrão —
 * a query do banco não pode ser dirigida por um número arbitrário vindo do
 * cliente.
 */
export function normalizePerPage(raw: string | number | null | undefined): number {
  const valor = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return PER_PAGE_OPTIONS.includes(valor as (typeof PER_PAGE_OPTIONS)[number])
    ? (valor as number)
    : DEFAULT_PER_PAGE;
}
