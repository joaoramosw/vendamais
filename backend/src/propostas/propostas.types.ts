import { PropostaStatus } from '../cotacoes/cotacoes.types';

export interface PropostaRow {
  id: string;
  cotacao_id: string;
  fornecedor_convidado_id: string;
  status: PropostaStatus;
  valor_total: number;
  prazo_entrega: string | null;
  created_at: string;
  /**
   * "Observações gerais" — texto livre que vale para a proposta inteira (≠
   * `PropostaItemRow.observacao`, que é por produto). Opcional no tipo porque
   * a coluna só existe depois da migration 023: antes dela o backend nem pede
   * o campo no `select` (ver PropostasService#observacaoGeralDisponivel).
   */
  observacao?: string | null;
}

export interface PropostaItemRow {
  id: string;
  proposta_id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao: string | null;
  disponivel: boolean;
  created_at: string;
}
