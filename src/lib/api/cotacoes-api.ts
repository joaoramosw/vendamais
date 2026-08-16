"use client";

import { apiFetch, apiFetchBlob } from "@/lib/api/backend-client";
import { triggerBlobDownload } from "@/lib/download";
import type { CotacaoStatus } from "@/lib/constants";

export interface CotacaoRow {
  id: string;
  admin_id: string;
  titulo: string;
  status: CotacaoStatus;
  data_abertura: string | null;
  data_fechamento: string | null;
  created_at: string;
  data_limite: string | null;
}

export interface CotacaoListItem extends CotacaoRow {
  itens: Array<{ id: string; cotacao_id: string; nome_produto: string; quantidade: number }>;
  propostas: Array<{ id: string; cotacao_id: string; status: string; valor_total: number | null }>;
  /** Grupo da tela de gerenciamento. `undefined` quando a migration 021 ainda
   * não rodou (o backend simplesmente não devolve o campo). */
  grupo_id?: string | null;
}

export interface CotacaoGrupo {
  id: string;
  admin_id: string;
  nome: string;
  created_at: string;
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

export interface FornecedorConvidadoRow {
  id: string;
  cotacao_id: string;
  token_acesso: string;
  email_contato: string | null;
  whatsapp: string | null;
  nome_empresa: string | null;
  status_convite: "pendente" | "visualizado" | "respondido";
  created_at: string;
}

export interface FornecedorBusca {
  id: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  organization_name: string | null;
  segmento_id: string | null;
}

export interface EnviarCotacaoItemPayload {
  nome_produto: string;
  unidade: string;
  tipo_unidade: string;
  quantidade: number;
  observacao?: string;
  codigo_barras?: string;
  categoria?: string;
  product_id?: string;
  descricao?: string;
  estoque_atual?: number;
  quantidade_sugerida?: number;
}

export interface EnviarCotacaoPayload {
  titulo: string;
  data_limite?: string;
  itens: EnviarCotacaoItemPayload[];
}

export type EnviarCotacaoResult =
  | { success: true; id: string; status: string }
  | { success: false; error: string };

/**
 * Replaces criarEPublicarCotacao (Server Action) for the online path —
 * calls the new backend, which builds cotacao_itens joins in application
 * code instead of a PostgREST embed (the missing FK that blocked the old
 * flow). See backend/src/cotacoes/cotacoes.service.ts.
 */
export async function enviarCotacao(payload: EnviarCotacaoPayload): Promise<EnviarCotacaoResult> {
  try {
    const result = await apiFetch<{ id: string; status: string }>("/cotacoes/enviar", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { success: true, id: result.id, status: result.status };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao enviar cotação.",
    };
  }
}

export type PublicarCotacaoResult =
  | { success: true; id: string; status: string }
  | { success: false; error: string };

/** Replaces publicarCotacao(id) — publishes an already-created rascunho.
 * Used by the offline sync queue, which creates once and retries publish
 * separately (so retries don't re-create the cotacao). */
export async function publicarCotacaoPorId(cotacaoId: string): Promise<PublicarCotacaoResult> {
  try {
    const result = await apiFetch<{ id: string; status: string }>(
      `/cotacoes/${cotacaoId}/publicar`,
      { method: "POST" },
    );
    return { success: true, id: result.id, status: result.status };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao publicar cotação.",
    };
  }
}

export type SalvarRascunhoResult =
  | { success: true; id: string; status: string }
  | { success: false; error: string };

/** Replaces criarCotacao(formData, false) — creates a 'rascunho' without publishing. */
export async function salvarRascunho(payload: EnviarCotacaoPayload): Promise<SalvarRascunhoResult> {
  try {
    const result = await apiFetch<{ id: string; status: string }>("/cotacoes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { success: true, id: result.id, status: result.status };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao salvar rascunho.",
    };
  }
}

/** Replaces the broken `getCotacoes` embed query (cotacoes.ts) — same data,
 * built from separate backend queries instead of a PostgREST embed. */
export async function listarCotacoes(): Promise<CotacaoListItem[]> {
  return apiFetch<CotacaoListItem[]>("/cotacoes");
}

export async function getCotacaoDetalhe(
  id: string,
): Promise<{ cotacao: CotacaoRow; itens: CotacaoItemRow[] }> {
  return apiFetch(`/cotacoes/${id}`);
}

export interface RankingEntry {
  proposta_id: string;
  fornecedor_convidado_id: string;
  nome_empresa: string | null;
  email_contato: string | null;
  whatsapp: string | null;
  preco_unitario: number;
  created_at: string;
  /** Observação escrita pelo fornecedor **para este item** (não para a
   * proposta inteira). Mostrada no acesso rápido / detalhe do item. */
  observacao: string | null;
  /** Prazo de entrega da proposta a que esta oferta pertence. */
  prazo_entrega: string | null;
  /** "Observações gerais" da proposta — condições que valem para tudo que
   * aquele fornecedor ofertou (pedido mínimo, frete, pagamento). Repetida em
   * cada entrada dele, como o prazo. `null` também enquanto a migration 023
   * não tiver rodado. */
  observacao_proposta: string | null;
}

export interface FornecedorIndisponivel {
  fornecedor_convidado_id: string;
  nome_empresa: string | null;
  email_contato: string | null;
  whatsapp: string | null;
  /** Justificativa do "não tenho", quando o fornecedor escreveu uma. */
  observacao: string | null;
}

export interface ItemResultado {
  cotacao_item_id: string;
  nome_produto: string;
  quantidade: number;
  quantidade_sugerida: number | null;
  estoque_atual: number | null;
  preco_unitario_manual: number | null;
  preco_manual: boolean;
  /**
   * Preço praticado na loja (`products.price_unit_store`), resolvido pelo
   * `product_id` do item — base do valor ideal de compra (ver
   * `src/lib/margem.ts`). `null` quando o item não veio do catálogo ou o
   * produto está sem preço cadastrado.
   */
  preco_loja: number | null;
  /** Ordenado por preço crescente — ranking[0] é o vencedor (menor preço). */
  ranking: RankingEntry[];
  /** Fornecedores convidados que responderam "Não tenho" para este item. */
  indisponiveis: FornecedorIndisponivel[];
}

/** Resultado por item — disponível assim que a cotação é publicada
 * ('aberta', resultado parcial que pode mudar até o encerramento) ou depois
 * de 'fechada' (resultado final); o backend recusa (400) antes disso. */
export async function getResultadoCotacao(
  cotacaoId: string,
): Promise<{ cotacao: CotacaoRow; itens: ItemResultado[] }> {
  return apiFetch(`/cotacoes/${cotacaoId}/resultado`);
}

export type EncerrarCotacaoResult =
  | { success: true }
  | { success: false; error: string };

/** Fecha a cotação explicitamente (PATCH /cotacoes/:id/status), independente
 * de aceitar uma proposta específica — o ranking por item pode ter
 * vencedores diferentes por produto, então encerrar não deveria depender de
 * escolher um único fornecedor "vencedor geral" (ver gerenciarProposta). */
export async function encerrarCotacao(cotacaoId: string): Promise<EncerrarCotacaoResult> {
  try {
    await apiFetch(`/cotacoes/${cotacaoId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "fechada" }),
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao encerrar cotação.",
    };
  }
}

/**
 * Retoma uma cotação pausada ('fechada' → 'aberta').
 *
 * "Pausar" na tela de gerenciamento é fechar temporariamente: o enum real de
 * `cotacao_status` não tem 'pausada' e não há acesso a DDL no projeto, então
 * a dupla pausar/retomar é fechar/reabrir. Ver ALLOWED_TRANSITIONS no backend.
 */
export async function reabrirCotacao(cotacaoId: string): Promise<EncerrarCotacaoResult> {
  try {
    await apiFetch(`/cotacoes/${cotacaoId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "aberta" }),
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao retomar cotação.",
    };
  }
}

export type DeletarCotacaoResult = { success: true } | { success: false; error: string };

/** Exclui uma cotação 'rascunho' ou 'aberta' (e tudo que depende dela — ver
 * backend/src/cotacoes/cotacoes.service.ts#deletarCotacao). Cotações
 * 'fechada'/'cancelada' já são histórico e o backend recusa (400). */
export async function deletarCotacao(cotacaoId: string): Promise<DeletarCotacaoResult> {
  try {
    await apiFetch<{ success: true }>(`/cotacoes/${cotacaoId}`, { method: "DELETE" });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao excluir cotação.",
    };
  }
}

/* ─── Grupos de cotação (migration 021) ───────────────────────────────────
 * `disponivel: false` significa que a migration ainda não foi aplicada no
 * banco — a tela continua funcionando, só sem agrupamento. Nunca trate isso
 * como erro de rede. */

export async function listarGruposCotacao(): Promise<{
  disponivel: boolean;
  grupos: CotacaoGrupo[];
}> {
  return apiFetch("/cotacoes/grupos");
}

export async function criarGrupoCotacao(nome: string): Promise<CotacaoGrupo> {
  return apiFetch("/cotacoes/grupos", {
    method: "POST",
    body: JSON.stringify({ nome }),
  });
}

export async function renomearGrupoCotacao(
  grupoId: string,
  nome: string,
): Promise<CotacaoGrupo> {
  return apiFetch(`/cotacoes/grupos/${grupoId}`, {
    method: "PATCH",
    body: JSON.stringify({ nome }),
  });
}

/** Apaga só o grupo — as cotações dele voltam para "Sem grupo". */
export async function excluirGrupoCotacao(grupoId: string): Promise<void> {
  await apiFetch(`/cotacoes/grupos/${grupoId}`, { method: "DELETE" });
}

/** Move um lote de cotações para um grupo; `grupoId = null` tira do grupo. */
export async function atribuirGrupoCotacoes(
  cotacaoIds: string[],
  grupoId: string | null,
): Promise<{ atualizadas: number }> {
  return apiFetch("/cotacoes/grupos/atribuir", {
    method: "PATCH",
    body: JSON.stringify({ cotacao_ids: cotacaoIds, grupo_id: grupoId }),
  });
}

export async function listarConvites(cotacaoId: string): Promise<FornecedorConvidadoRow[]> {
  return apiFetch(`/cotacoes/${cotacaoId}/convites`);
}

export async function convidarFornecedor(
  cotacaoId: string,
  contato: { emailContato?: string; whatsapp?: string; nomeEmpresa?: string },
): Promise<FornecedorConvidadoRow> {
  return apiFetch(`/cotacoes/${cotacaoId}/convites`, {
    method: "POST",
    body: JSON.stringify({
      email_contato: contato.emailContato,
      whatsapp: contato.whatsapp,
      nome_empresa: contato.nomeEmpresa,
    }),
  });
}

/** Busca fornecedores (role 'supplier') pro seletor do modal de convite por
 * WhatsApp — busca é feita no backend em nome/whatsapp/email. */
export async function buscarFornecedores(
  busca?: string,
  segmentoId?: string,
): Promise<FornecedorBusca[]> {
  const params = new URLSearchParams();
  if (busca) params.set("busca", busca);
  if (segmentoId) params.set("segmento_id", segmentoId);
  const query = params.toString();
  return apiFetch(`/cotacoes/fornecedores${query ? `?${query}` : ""}`);
}

/** Cria convites para usuários específicos (selecionados no modal de
 * WhatsApp) — dedupe de convites já existentes é feito no backend. */
export async function convidarPorUsuarios(
  cotacaoId: string,
  userIds: string[],
): Promise<FornecedorConvidadoRow[]> {
  return apiFetch(`/cotacoes/${cotacaoId}/convites/usuarios`, {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export interface AtualizarItemPayload {
  quantidade_sugerida?: number;
  preco_unitario_manual?: number;
  resetar_preco_manual?: boolean;
}

/** Ajusta Sugestão e/ou preço manual de um item já existente — editável
 * tanto na tela de detalhe (aberta) quanto em /resultados (fechada); ver
 * backend/src/cotacoes/cotacoes.service.ts#atualizarItem. */
export async function atualizarItemCotacao(
  cotacaoId: string,
  itemId: string,
  payload: AtualizarItemPayload,
): Promise<CotacaoItemRow> {
  return apiFetch(`/cotacoes/${cotacaoId}/itens/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Baixa a exportação (xlsx/pdf) da cotação e dispara o download no browser. */
export async function exportarCotacao(
  cotacaoId: string,
  formato: "xlsx" | "pdf",
  incluirInternos: boolean,
): Promise<void> {
  const params = new URLSearchParams({
    formato,
    incluir_internos: String(incluirInternos),
  });
  const { blob, filename } = await apiFetchBlob(`/cotacoes/${cotacaoId}/export?${params.toString()}`);
  triggerBlobDownload(blob, filename);
}

