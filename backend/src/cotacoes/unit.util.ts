/**
 * Unidade comercial dos itens de cotação — e a convivência com a constraint
 * defasada do banco real.
 *
 * O banco de produção ainda carrega a versão pré-Fardo de
 * `cotacao_itens_tipo_unidade_check` (aceita só UN|CX|DZ): a migration
 * `supabase/migrations/005_allow_fd_unit_type.sql` existe no repo mas nunca
 * foi aplicada lá (ver CLAUDE.md). Confirmado ao vivo: inserir
 * `tipo_unidade = 'FD'` devolve 23514 e derruba o insert inteiro de itens —
 * ou seja, uma única linha marcada como "Fardo" impedia publicar a cotação.
 *
 * `cotacao_itens.unidade` não tem constraint nenhuma, então é ela que guarda
 * a unidade real. `tipo_unidade` só é rebaixado pra um valor aceito quando o
 * banco recusa o valor verdadeiro, e volta a ser gravado corretamente
 * sozinho assim que a migration 005 for aplicada — sem mudança de código.
 */
export const APP_UNIT_TYPES = ['UN', 'CX', 'DZ', 'FD'] as const;
export type AppUnitType = (typeof APP_UNIT_TYPES)[number];

const APP_UNIT_SET: ReadonlySet<string> = new Set<string>(APP_UNIT_TYPES);

/** Valores que a constraint pré-005 aceita no banco real. */
const LEGACY_CONSTRAINT_UNITS: ReadonlySet<string> = new Set(['UN', 'CX', 'DZ']);

export const FALLBACK_UNIT: AppUnitType = 'UN';

/** Devolve o código canônico (maiúsculo) quando `raw` é uma unidade conhecida. */
export function normalizeUnit(raw: string | null | undefined): AppUnitType | null {
  const value = (raw ?? '').trim().toUpperCase();
  return APP_UNIT_SET.has(value) ? (value as AppUnitType) : null;
}

/**
 * Unidade real do item: `unidade` primeiro (é a coluna sem constraint, logo a
 * única confiável), caindo pra `tipo_unidade` quando `unidade` não traz um
 * código conhecido — o que cobre tanto as linhas antigas em minúsculo
 * ('cx', 'un') quanto as linhas gravadas com `tipo_unidade` rebaixado.
 */
export function resolveUnit(row: {
  unidade?: string | null;
  tipo_unidade?: string | null;
}): AppUnitType {
  return normalizeUnit(row.unidade) ?? normalizeUnit(row.tipo_unidade) ?? FALLBACK_UNIT;
}

/** Valor de `tipo_unidade` que a constraint antiga aceita. */
export function toLegacySafeUnit(raw: string | null | undefined): AppUnitType {
  const unit = normalizeUnit(raw);
  return unit && LEGACY_CONSTRAINT_UNITS.has(unit) ? unit : FALLBACK_UNIT;
}

/** `true` quando o erro do Postgres é a check constraint de `tipo_unidade`. */
export function isTipoUnidadeCheckViolation(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  return error?.code === '23514' && /tipo_unidade/i.test(error?.message ?? '');
}
