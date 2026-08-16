"use client";

import { apiFetch } from "@/lib/api/backend-client";

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

export interface PropostaComItens {
  id: string;
  cotacao_id: string;
  fornecedor_convidado_id: string;
  status: "rascunho" | "enviada" | "aceita" | "recusada";
  valor_total: number;
  prazo_entrega: string | null;
  created_at: string;
  itens: PropostaItemRow[];
  email_contato: string | null;
  whatsapp: string | null;
  nome_empresa: string | null;
}

/** Replaces the old getProposta/getMinhasPropostas Server Actions, which
 * still assumed propostas.fornecedor_id -> profiles (doesn't exist). */
export async function listarPropostasPorCotacao(cotacaoId: string): Promise<PropostaComItens[]> {
  return apiFetch<PropostaComItens[]>(`/cotacoes/${cotacaoId}/propostas`);
}

export type GerenciarPropostaResult =
  | { success: true }
  | { success: false; error: string };

/** Replaces gerenciarProposta(id, status) Server Action. */
export async function gerenciarProposta(
  propostaId: string,
  status: "aceita" | "recusada",
): Promise<GerenciarPropostaResult> {
  try {
    await apiFetch(`/propostas/${propostaId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar proposta.",
    };
  }
}
