/* ─── Cotação (Quotation) ─── */

export type CotacaoStatus =
  | "rascunho"
  | "enviada"
  | "em-analise"
  | "aceita"
  | "recusada"
  | "expirada";

export interface CotacaoItem {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  especificacao?: string;
}

export interface Cotacao {
  id: string;
  titulo: string;
  categoria: string;
  prazo: string; // ISO date
  observacoes?: string;
  status: CotacaoStatus;
  itens: CotacaoItem[];
  fornecedores: string[]; // fornecedor IDs
  criadoEm: string;
  atualizadoEm: string;
}

/* ─── Proposta (Proposal) ─── */

export type PropostaStatus =
  | "rascunho"
  | "enviada"
  | "aceita"
  | "recusada";

export interface PropostaItem {
  itemId: string;
  precoUnitario: number;
  prazoEntrega: string;
  observacao?: string;
}

export interface Proposta {
  id: string;
  cotacaoId: string;
  fornecedorId: string;
  fornecedorNome: string;
  status: PropostaStatus;
  itens: PropostaItem[];
  condicoesGerais?: string;
  total: number;
  criadoEm: string;
}

/* ─── Fornecedor (Supplier) ─── */

export interface Fornecedor {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  empresa?: string;
}
