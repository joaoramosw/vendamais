// Valores reais confirmados ao vivo contra o Supabase (GET /rest/v1/, enum
// public.cotacao_status) — NÃO 'em_andamento'/'encerrada', que nunca
// existiram no banco real (ver CLAUDE.md "Known Issues" e o plano da sessão
// de reconstrução do backend cotacoes/propostas).
export type CotacaoStatus = 'rascunho' | 'aberta' | 'fechada' | 'cancelada'

export const COTACAO_STATUS_LABELS: Record<CotacaoStatus, string> = {
  rascunho: 'Rascunho',
  aberta: 'Aberta',
  fechada: 'Fechada',
  cancelada: 'Cancelada',
} as const

// Valores reais confirmados ao vivo (enum public.proposta_status) — sem 'recebida'.
export const PROPOSTA_STATUS_LABELS = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aceita: 'Aceita',
  recusada: 'Recusada',
} as const

export const USER_TIPO_LABELS = {
  empresario: 'Empresário',
  fornecedor: 'Fornecedor',
} as const

// Unidade comercial para itens de cotação
export const UNIT_TYPES = ['UN', 'CX', 'DZ', 'FD'] as const
export type UnitType = typeof UNIT_TYPES[number]

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  UN: 'Unidade',
  CX: 'Caixa',
  DZ: 'Dúzia',
  FD: 'Fardo',
}

export const UNIT_TYPE_ICONS: Record<UnitType, string> = {
  UN: '📦',
  CX: '🗃️',
  DZ: '🔢',
  FD: '📫',
}

export const CATEGORIAS = [
  { value: 'alimentos', label: 'Alimentos' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'higiene', label: 'Higiene' },
  { value: 'escritorio', label: 'Escritório' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'construcao', label: 'Construção' },
  { value: 'eletronicos', label: 'Eletrônicos' },
  { value: 'vestuario', label: 'Vestuário' },
  { value: 'outros', label: 'Outros' },
] as const

// Legacy list — kept for backward compatibility
export const UNIDADES = [
  'un',
  'kg',
  'g',
  'L',
  'mL',
  'cx',
  'pct',
  'fardo',
  'dúzia',
] as const

// ─── Scoring system for supplier ranking ───
// Points awarded by position (easily adjustable)
export const SCORING_RULES: Record<number, number> = {
  1: 5,  // 1º lugar → 5 pontos
  2: 3,  // 2º lugar → 3 pontos
  3: 1,  // 3º lugar → 1 ponto
}
export const SCORING_DEFAULT = 0 // positions beyond 3rd

// ─── Margin calculation ───
export const DEFAULT_MARGIN_PERCENT = 28.5

