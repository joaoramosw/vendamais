/**
 * Real enum values confirmed live via GET /rest/v1/ (OpenAPI) against the
 * actual Supabase project — do NOT trust supabase/migration.sql or the old
 * Next.js code for these (see CLAUDE.md alert). cotacao_status has no
 * 'em_andamento'/'encerrada' values; proposta_status has no 'recebida'.
 */
export type CotacaoStatus = 'rascunho' | 'aberta' | 'fechada' | 'cancelada';
export type PropostaStatus = 'rascunho' | 'enviada' | 'aceita' | 'recusada';

export interface CotacaoRow {
  id: string;
  admin_id: string;
  titulo: string;
  status: CotacaoStatus;
  data_abertura: string | null;
  data_fechamento: string | null;
  created_at: string;
  data_limite: string | null;
  /**
   * Grupo da tela de gerenciamento (migration 021). Opcional no tipo porque a
   * coluna só existe depois da migration — as leituras que a incluem são
   * condicionais (ver CotacoesService#gruposDisponiveis); quando ela não
   * existe, o campo simplesmente não vem.
   */
  grupo_id?: string | null;
}

export interface CotacaoItemRow {
  id: string;
  cotacao_id: string;
  nome_produto: string;
  unidade: string;
  quantidade: number;
  observacao: string | null;
  codigo_barras: string | null;
  categoria: string | null;
  product_id: string | null;
  descricao: string | null;
  estoque_atual: number | null;
  quantidade_sugerida: number | null;
  tipo_unidade: string;
  preco_unitario_manual: number | null;
  preco_manual: boolean;
}
