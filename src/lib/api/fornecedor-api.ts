"use client";

import { apiFetch } from "@/lib/api/backend-client";
import { PROPOSTA_STATUS_LABELS, type CotacaoStatus } from "@/lib/constants";

export type PropostaStatus = keyof typeof PROPOSTA_STATUS_LABELS;

export interface MeuConvite {
  id: string;
  token_acesso: string;
  status_convite: "pendente" | "visualizado" | "respondido";
  proposta_id: string | null;
  email_contato: string | null;
  whatsapp: string | null;
  cotacao: {
    id: string;
    titulo: string;
    status: CotacaoStatus;
    data_limite: string | null;
    created_at: string;
  } | null;
}

export interface MinhaProposta {
  id: string;
  cotacao_id: string;
  status: PropostaStatus;
  valor_total: number | null;
  prazo_entrega: string | null;
  created_at: string;
  cotacao: {
    id: string;
    titulo: string;
    status: CotacaoStatus;
    data_limite: string | null;
  } | null;
}

export interface MinhaPropostaDetalhe extends MinhaProposta {
  itens: Array<{
    id: string;
    produto_nome: string;
    quantidade: number;
    preco_unitario: number;
    observacao: string | null;
    /** `false` = o fornecedor respondeu "não tenho" para este item. */
    disponivel: boolean;
  }>;
}

/**
 * Convites endereçados à conta logada — casados por e-mail contra
 * fornecedores_convidados.email_contato (não existe FK entre essa tabela
 * e users/profiles no schema real; ver plano desta sessão).
 */
export async function listarMeusConvites(): Promise<MeuConvite[]> {
  return apiFetch<MeuConvite[]>("/fornecedor/convites");
}

/**
 * Propostas enviadas pela conta logada — mesma ponte por e-mail
 * (propostas.fornecedor_id não existe no schema real).
 */
export async function listarMinhasPropostas(): Promise<MinhaProposta[]> {
  return apiFetch<MinhaProposta[]>("/fornecedor/propostas");
}

export async function detalharMinhaProposta(id: string): Promise<MinhaPropostaDetalhe> {
  return apiFetch<MinhaPropostaDetalhe>(`/fornecedor/propostas/${id}`);
}
