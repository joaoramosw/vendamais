import "server-only";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/server/http";
import { adminClient } from "@/server/supabase";
import type { CreateCotacaoInput, UpdateCotacaoItemInput } from "./dto";
import type { CotacaoItemRow, CotacaoRow, CotacaoStatus } from "./cotacoes.types";
import {
  isTipoUnidadeCheckViolation,
  normalizeUnit,
  resolveUnit,
  toLegacySafeUnit,
} from "./unit.util";
import {
  digitosDoTelefone,
  emailSentinelaParaWhatsapp,
  normalizarWhatsapp,
  semSentinela,
} from "./convite-contato.util";

/**
 * Domínio de cotações — conversão 1:1 do `CotacoesService` do backend NestJS
 * para funções server-side do Next. Comportamento preservado; o que era
 * estado da classe (probes de migration) virou estado de módulo, com a mesma
 * semântica: otimização por instância, nunca requisito de correção — uma
 * instância serverless nova só paga um probe a mais.
 */

export interface CotacaoListItem extends CotacaoRow {
  itens: Array<{ id: string; cotacao_id: string; nome_produto: string; quantidade: number }>;
  propostas: Array<{ id: string; cotacao_id: string; status: string; valor_total: number | null }>;
}

export interface CotacaoGrupoRow {
  id: string;
  admin_id: string;
  nome: string;
  created_at: string;
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

export interface FornecedorUsuarioRow {
  id: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  organization_name: string | null;
  segmento_id: string | null;
}

const CLOSED_STATUSES: CotacaoStatus[] = ["fechada", "cancelada"];

// Real transitions confirmed against the live enum (rascunho|aberta|fechada|cancelada) —
// no 'em_andamento'/'encerrada', unlike the old Next.js code's assumptions.
//
// 'fechada' -> 'aberta' é a volta do "Pausar" da tela de gerenciamento: o
// enum real não tem 'pausada' e não há acesso a DDL por aqui, então pausar =
// fechar temporariamente e retomar = reabrir.
const ALLOWED_TRANSITIONS: Record<CotacaoStatus, CotacaoStatus[]> = {
  rascunho: ["aberta", "cancelada"],
  aberta: ["fechada", "cancelada"],
  fechada: ["aberta"],
  cancelada: [],
};

const COTACAO_FIELDS =
  "id, admin_id, titulo, status, data_abertura, data_fechamento, created_at, data_limite";

const ITEM_FIELDS =
  "id, cotacao_id, nome_produto, unidade, quantidade, observacao, codigo_barras, categoria, product_id, descricao, estoque_atual, quantidade_sugerida, tipo_unidade, preco_unitario_manual, preco_manual";

const CONVIDADO_FIELDS =
  "id, cotacao_id, token_acesso, email_contato, whatsapp, nome_empresa, status_convite, created_at";

/** Quanto tempo esperar antes de re-testar a existência de `cotacao_grupos`
 * depois de um teste negativo — assim, rodar a migration 021 passa a valer
 * sem reiniciar o servidor. */
const GRUPOS_PROBE_TTL_MS = 60_000;

const GRUPOS_INDISPONIVEIS_MSG =
  "Agrupamento indisponível: a migration 021_cotacao_grupos.sql ainda não foi aplicada no banco.";

/**
 * Creates a 'rascunho' cotacao + its itens. Does NOT use a PostgREST
 * embed anywhere — cotacao_itens has no FK to cotacoes in the live
 * schema, so embeds (`cotacoes?select=*,cotacao_itens(*)`) always fail
 * with PGRST200.
 */
export async function criarCotacao(adminId: string, dto: CreateCotacaoInput): Promise<CotacaoRow> {
  const supabase = adminClient();

  const { data: cotacao, error: insertError } = await supabase
    .from("cotacoes")
    .insert({
      admin_id: adminId,
      titulo: dto.titulo,
      status: "rascunho" as CotacaoStatus,
      data_limite: dto.data_limite ?? null,
    })
    .select(COTACAO_FIELDS)
    .single();

  if (insertError || !cotacao) {
    throw new BadRequestException(insertError?.message ?? "Falha ao criar cotação.");
  }

  const itensPayload = dto.itens.map((item) => {
    // `unidade` (sem constraint) guarda a unidade real; `tipo_unidade` é a
    // coluna com a check constraint defasada — ver unit.util.ts.
    const unidadeReal = normalizeUnit(item.tipo_unidade) ?? normalizeUnit(item.unidade);

    return {
      cotacao_id: cotacao.id,
      nome_produto: item.nome_produto,
      unidade: unidadeReal ?? item.unidade,
      quantidade: item.quantidade,
      observacao: item.observacao ?? null,
      codigo_barras: item.codigo_barras ?? null,
      categoria: item.categoria ?? null,
      product_id: item.product_id ?? null,
      descricao: item.descricao ?? null,
      estoque_atual: item.estoque_atual ?? null,
      quantidade_sugerida: item.quantidade_sugerida ?? null,
      tipo_unidade: item.tipo_unidade,
    };
  });

  let { error: itensError } = await supabase.from("cotacao_itens").insert(itensPayload);

  if (isTipoUnidadeCheckViolation(itensError)) {
    // Banco ainda sem a migration 005: um item "Fardo" derruba o insert
    // inteiro e a cotação nunca chega a ser publicada. Regrava só
    // `tipo_unidade` com um valor que a constraint antiga aceita — a
    // unidade real continua em `unidade` e é ela que as leituras usam
    // (resolveUnit). Assim que 005 rodar, o primeiro insert passa e este
    // caminho deixa de ser exercitado, sem mudança de código.
    const rebaixados = itensPayload.map((item) => ({
      ...item,
      tipo_unidade: toLegacySafeUnit(item.tipo_unidade),
    }));

    console.warn(
      "cotacao_itens_tipo_unidade_check recusou as unidades desta cotação — regravando tipo_unidade com o fallback aceito pelo banco. Rode supabase/migrations/005_allow_fd_unit_type.sql para restaurar o comportamento nativo.",
    );

    ({ error: itensError } = await supabase.from("cotacao_itens").insert(rebaixados));
  }

  if (itensError) {
    const { error: rollbackError } = await supabase
      .from("cotacoes")
      .delete()
      .eq("id", cotacao.id);

    if (rollbackError) {
      console.error(
        `Failed to roll back orphan cotacao ${cotacao.id} after item insert failure: ${rollbackError.message}`,
      );
    }

    throw new BadRequestException(itensError.message);
  }

  return cotacao as CotacaoRow;
}

async function fetchCotacaoOrThrow(id: string): Promise<CotacaoRow> {
  const { data, error } = await adminClient()
    .from("cotacoes")
    .select(COTACAO_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    throw new NotFoundException("Cotação não encontrada.");
  }

  return data as CotacaoRow;
}

async function countItens(cotacaoId: string): Promise<number> {
  const { count, error } = await adminClient()
    .from("cotacao_itens")
    .select("id", { count: "exact", head: true })
    .eq("cotacao_id", cotacaoId);

  if (error) {
    throw new BadRequestException(error.message);
  }

  return count ?? 0;
}

/** Deletes the cotacao AND its itens — fixes the orphan-itens bug found
 * live in production (11 orphaned drafts, 38 orphaned itens) caused by
 * the old deleteOrphanCotacao only deleting the cotacoes row. */
async function deleteCotacaoAndItens(cotacaoId: string): Promise<void> {
  const supabase = adminClient();

  const { error: itensDeleteError } = await supabase
    .from("cotacao_itens")
    .delete()
    .eq("cotacao_id", cotacaoId);

  if (itensDeleteError) {
    console.error(
      `Failed to delete orphan cotacao_itens for ${cotacaoId}: ${itensDeleteError.message}`,
    );
  }

  const { error: cotacaoDeleteError } = await supabase
    .from("cotacoes")
    .delete()
    .eq("id", cotacaoId);

  if (cotacaoDeleteError) {
    console.error(`Failed to delete orphan cotacao ${cotacaoId}: ${cotacaoDeleteError.message}`);
  }
}

/**
 * Exclui a cotação e tudo que depende dela (itens, convites, propostas e
 * itens de proposta).
 *
 * Vale para **qualquer status**, inclusive 'fechada' — "pausar" no produto é
 * fechar (o enum real não tem 'pausada'), então um gate de status tornaria
 * impossível apagar uma cotação só porque ela foi pausada. A proteção é a do
 * dono (`admin_id`) mais a confirmação explícita na UI.
 */
export async function deletarCotacao(adminId: string, cotacaoId: string): Promise<void> {
  const cotacao = await fetchCotacaoOrThrow(cotacaoId);

  if (cotacao.admin_id !== adminId) {
    throw new ForbiddenException("Você não é o responsável por esta cotação.");
  }

  const supabase = adminClient();

  const { data: propostas, error: propostasError } = await supabase
    .from("propostas")
    .select("id")
    .eq("cotacao_id", cotacaoId);

  if (propostasError) {
    throw new BadRequestException(propostasError.message);
  }

  const propostaIds = (propostas ?? []).map((p) => p.id);

  if (propostaIds.length > 0) {
    const { error: itensError } = await supabase
      .from("proposta_itens")
      .delete()
      .in("proposta_id", propostaIds);

    if (itensError) {
      throw new BadRequestException(itensError.message);
    }

    const { error: propostasDeleteError } = await supabase
      .from("propostas")
      .delete()
      .eq("cotacao_id", cotacaoId);

    if (propostasDeleteError) {
      throw new BadRequestException(propostasDeleteError.message);
    }
  }

  const { error: convidadosError } = await supabase
    .from("fornecedores_convidados")
    .delete()
    .eq("cotacao_id", cotacaoId);

  if (convidadosError) {
    throw new BadRequestException(convidadosError.message);
  }

  const { error: itensError } = await supabase
    .from("cotacao_itens")
    .delete()
    .eq("cotacao_id", cotacaoId);

  if (itensError) {
    throw new BadRequestException(itensError.message);
  }

  const { error: cotacaoError } = await supabase.from("cotacoes").delete().eq("id", cotacaoId);

  if (cotacaoError) {
    throw new BadRequestException(cotacaoError.message);
  }
}

export async function publicarCotacao(adminId: string, cotacaoId: string): Promise<CotacaoRow> {
  const cotacao = await fetchCotacaoOrThrow(cotacaoId);

  if (cotacao.admin_id !== adminId) {
    throw new ForbiddenException("Você não é o responsável por esta cotação.");
  }

  if (cotacao.status === "aberta") {
    return cotacao; // idempotent
  }

  if (CLOSED_STATUSES.includes(cotacao.status)) {
    throw new BadRequestException(
      `Cotação está com status "${cotacao.status}" e não pode ser publicada.`,
    );
  }

  const itensCount = await countItens(cotacaoId);
  if (itensCount === 0) {
    throw new BadRequestException("A cotação precisa ter pelo menos 1 item para ser publicada.");
  }

  const { data: updated, error: updateError } = await adminClient()
    .from("cotacoes")
    .update({ status: "aberta" as CotacaoStatus })
    .eq("id", cotacaoId)
    .eq("status", "rascunho") // optimistic lock
    .select(COTACAO_FIELDS)
    .maybeSingle();

  if (updateError) {
    throw new BadRequestException(updateError.message);
  }

  if (!updated) {
    throw new ConflictException("Cotação já foi publicada por outra requisição.");
  }

  return updated as CotacaoRow;
}

export async function criarEPublicarCotacao(
  adminId: string,
  dto: CreateCotacaoInput,
): Promise<CotacaoRow> {
  const cotacao = await criarCotacao(adminId, dto);

  try {
    return await publicarCotacao(adminId, cotacao.id);
  } catch (publishError) {
    await deleteCotacaoAndItens(cotacao.id);
    throw publishError;
  }
}

/** List + a lightweight summary (itens count, propostas count/status/valor)
 * per cotacao — built from separate queries grouped in code, same reason
 * as everywhere else in this module: no PostgREST embed, no FK needed. */
export async function listarCotacoes(adminId: string): Promise<CotacaoListItem[]> {
  const supabase = adminClient();

  // `grupo_id` só entra no select quando a migration 021 já rodou —
  // pedir uma coluna inexistente derruba a listagem inteira com 42703.
  const comGrupos = await gruposDisponiveis();
  // Tipado como `string` (e não literal) de propósito: o parser de tipos do
  // supabase-js só entende select literal, e aqui a lista de colunas é
  // decidida em runtime.
  const select: string = comGrupos ? `${COTACAO_FIELDS}, grupo_id` : COTACAO_FIELDS;
  const { data, error } = await supabase
    .from("cotacoes")
    .select(select)
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new BadRequestException(error.message);
  }

  // `as unknown` no meio: com select dinâmico o supabase-js não consegue
  // inferir a forma da linha e cai num tipo de erro genérico.
  const cotacoes = (data ?? []) as unknown as CotacaoRow[];
  if (cotacoes.length === 0) return [];

  const ids = cotacoes.map((c) => c.id);

  const { data: itens, error: itensError } = await supabase
    .from("cotacao_itens")
    .select("id, cotacao_id, nome_produto, quantidade")
    .in("cotacao_id", ids);

  if (itensError) {
    throw new BadRequestException(itensError.message);
  }

  const { data: propostas, error: propostasError } = await supabase
    .from("propostas")
    .select("id, cotacao_id, status, valor_total")
    .in("cotacao_id", ids);

  if (propostasError) {
    throw new BadRequestException(propostasError.message);
  }

  return cotacoes.map((cotacao) => ({
    ...cotacao,
    itens: (itens ?? []).filter((item) => item.cotacao_id === cotacao.id),
    propostas: (propostas ?? []).filter((p) => p.cotacao_id === cotacao.id),
  }));
}

/* ─────────────────────── Grupos de cotação (migration 021) ───────────────
 * Toda esta seção degrada em vez de quebrar quando a migration ainda não
 * foi aplicada no banco — mesmo padrão das migrations 018/019/020.
 * ------------------------------------------------------------------------ */

let gruposSuportados: boolean | null = null;
let gruposProbeAt = 0;

/** `true` quando a tabela `cotacao_grupos` existe. Resultado positivo é
 * definitivo (por instância); negativo é re-testado a cada minuto, para que
 * rodar a migration passe a valer sem redeploy. */
async function gruposDisponiveis(): Promise<boolean> {
  if (gruposSuportados === true) return true;
  if (gruposSuportados === false && Date.now() - gruposProbeAt < GRUPOS_PROBE_TTL_MS) {
    return false;
  }

  const { error } = await adminClient().from("cotacao_grupos").select("id").limit(1);

  gruposProbeAt = Date.now();
  gruposSuportados = !error;

  if (error) {
    console.warn(`cotacao_grupos indisponível (${error.code ?? "?"}): ${error.message}`);
  }

  return gruposSuportados;
}

async function assertGruposDisponiveis(): Promise<void> {
  if (!(await gruposDisponiveis())) {
    throw new BadRequestException(GRUPOS_INDISPONIVEIS_MSG);
  }
}

async function fetchGrupoOrThrow(adminId: string, grupoId: string): Promise<CotacaoGrupoRow> {
  const { data, error } = await adminClient()
    .from("cotacao_grupos")
    .select("id, admin_id, nome, created_at")
    .eq("id", grupoId)
    .maybeSingle();

  if (error) throw new BadRequestException(error.message);
  if (!data) throw new NotFoundException("Grupo não encontrado.");

  const grupo = data as CotacaoGrupoRow;
  if (grupo.admin_id !== adminId) {
    throw new ForbiddenException("Este grupo pertence a outro usuário.");
  }

  return grupo;
}

export async function listarGrupos(
  adminId: string,
): Promise<{ disponivel: boolean; grupos: CotacaoGrupoRow[] }> {
  if (!(await gruposDisponiveis())) {
    return { disponivel: false, grupos: [] };
  }

  const { data, error } = await adminClient()
    .from("cotacao_grupos")
    .select("id, admin_id, nome, created_at")
    .eq("admin_id", adminId)
    .order("nome", { ascending: true });

  if (error) throw new BadRequestException(error.message);

  return { disponivel: true, grupos: (data ?? []) as CotacaoGrupoRow[] };
}

/** Cria — ou reaproveita, se já existir um com o mesmo nome (case-insensitive,
 * igual ao índice único da migration). Reaproveitar evita que "Agrupar →
 * digita o nome de novo" produza dois grupos visualmente idênticos. */
export async function criarGrupo(adminId: string, nome: string): Promise<CotacaoGrupoRow> {
  await assertGruposDisponiveis();
  const supabase = adminClient();

  const { data: existente, error: buscaError } = await supabase
    .from("cotacao_grupos")
    .select("id, admin_id, nome, created_at")
    .eq("admin_id", adminId)
    .ilike("nome", nome)
    .maybeSingle();

  if (buscaError) throw new BadRequestException(buscaError.message);
  if (existente) return existente as CotacaoGrupoRow;

  const { data, error } = await supabase
    .from("cotacao_grupos")
    .insert({ admin_id: adminId, nome })
    .select("id, admin_id, nome, created_at")
    .maybeSingle();

  if (error) throw new BadRequestException(error.message);
  if (!data) throw new BadRequestException("Não foi possível criar o grupo.");

  return data as CotacaoGrupoRow;
}

export async function renomearGrupo(
  adminId: string,
  grupoId: string,
  nome: string,
): Promise<CotacaoGrupoRow> {
  await assertGruposDisponiveis();
  await fetchGrupoOrThrow(adminId, grupoId);

  const { data, error } = await adminClient()
    .from("cotacao_grupos")
    .update({ nome })
    .eq("id", grupoId)
    .eq("admin_id", adminId)
    .select("id, admin_id, nome, created_at")
    .maybeSingle();

  if (error) throw new BadRequestException(error.message);
  if (!data) throw new NotFoundException("Grupo não encontrado.");

  return data as CotacaoGrupoRow;
}

/** Apaga só o grupo — as cotações voltam para "Sem grupo" (ON DELETE SET
 * NULL na migration). Nenhuma cotação é excluída por aqui. */
export async function excluirGrupo(adminId: string, grupoId: string): Promise<void> {
  await assertGruposDisponiveis();
  await fetchGrupoOrThrow(adminId, grupoId);

  const { error } = await adminClient()
    .from("cotacao_grupos")
    .delete()
    .eq("id", grupoId)
    .eq("admin_id", adminId);

  if (error) throw new BadRequestException(error.message);
}

/** Move um lote de cotações para um grupo (ou para fora de qualquer grupo,
 * com `grupoId = null`). O `.eq('admin_id')` no update é o que impede
 * mexer em cotação de outro dono mesmo com id válido no payload. */
export async function atribuirGrupo(
  adminId: string,
  cotacaoIds: string[],
  grupoId: string | null,
): Promise<{ atualizadas: number }> {
  await assertGruposDisponiveis();

  if (grupoId) {
    await fetchGrupoOrThrow(adminId, grupoId);
  }

  const { data, error } = await adminClient()
    .from("cotacoes")
    .update({ grupo_id: grupoId })
    .in("id", cotacaoIds)
    .eq("admin_id", adminId)
    .select("id");

  if (error) throw new BadRequestException(error.message);

  return { atualizadas: (data ?? []).length };
}

export async function detalheCotacao(
  adminId: string,
  cotacaoId: string,
): Promise<{ cotacao: CotacaoRow; itens: CotacaoItemRow[] }> {
  const cotacao = await fetchCotacaoOrThrow(cotacaoId);

  if (cotacao.admin_id !== adminId) {
    throw new ForbiddenException("Você não é o responsável por esta cotação.");
  }

  const { data: itens, error: itensError } = await adminClient()
    .from("cotacao_itens")
    .select(ITEM_FIELDS)
    .eq("cotacao_id", cotacaoId);

  if (itensError) {
    throw new BadRequestException(itensError.message);
  }

  // Unidade real resolvida na resposta: quando o banco rebaixou
  // `tipo_unidade` (constraint pré-005), quem carrega o valor verdadeiro é
  // `unidade` — a API sempre devolve os dois já coerentes.
  const itensOrdenados = ((itens ?? []) as CotacaoItemRow[])
    .map((item) => {
      const unidade = resolveUnit(item);
      return { ...item, unidade, tipo_unidade: unidade };
    })
    .sort((a, b) => a.nome_produto.localeCompare(b.nome_produto, "pt-BR"));

  return { cotacao, itens: itensOrdenados };
}

/** Ajuste de Sugestão (quantidade_sugerida) e/ou preço unitário manual num
 * item já existente. Editável em qualquer status exceto 'cancelada'. */
export async function atualizarItem(
  adminId: string,
  cotacaoId: string,
  itemId: string,
  dto: UpdateCotacaoItemInput,
): Promise<CotacaoItemRow> {
  const cotacao = await fetchCotacaoOrThrow(cotacaoId);

  if (cotacao.admin_id !== adminId) {
    throw new ForbiddenException("Você não é o responsável por esta cotação.");
  }

  if (cotacao.status === "cancelada") {
    throw new BadRequestException("Cotação cancelada — itens não podem mais ser editados.");
  }

  const update: Record<string, unknown> = {};

  if (dto.quantidade_sugerida !== undefined) {
    update.quantidade_sugerida = dto.quantidade_sugerida;
  }

  if (dto.resetar_preco_manual) {
    update.preco_unitario_manual = null;
    update.preco_manual = false;
  } else if (dto.preco_unitario_manual !== undefined) {
    update.preco_unitario_manual = dto.preco_unitario_manual;
    update.preco_manual = true;
  }

  if (Object.keys(update).length === 0) {
    throw new BadRequestException("Nenhum campo para atualizar foi informado.");
  }

  const { data: updated, error } = await adminClient()
    .from("cotacao_itens")
    .update(update)
    .eq("id", itemId)
    .eq("cotacao_id", cotacaoId)
    .select(ITEM_FIELDS)
    .maybeSingle();

  if (error) {
    throw new BadRequestException(error.message);
  }

  if (!updated) {
    throw new NotFoundException("Item não encontrado nesta cotação.");
  }

  const item = updated as CotacaoItemRow;
  const unidade = resolveUnit(item);
  return { ...item, unidade, tipo_unidade: unidade };
}

export async function atualizarStatus(
  adminId: string,
  cotacaoId: string,
  novoStatus: CotacaoStatus,
): Promise<CotacaoRow> {
  const cotacao = await fetchCotacaoOrThrow(cotacaoId);

  if (cotacao.admin_id !== adminId) {
    throw new ForbiddenException("Você não é o responsável por esta cotação.");
  }

  const allowed = ALLOWED_TRANSITIONS[cotacao.status] ?? [];
  if (!allowed.includes(novoStatus)) {
    throw new BadRequestException(
      `Transição de "${cotacao.status}" para "${novoStatus}" não é permitida.`,
    );
  }

  const supabase = adminClient();

  // Retomar ('fechada' -> 'aberta') existe para desfazer uma pausa, não
  // para reabrir uma compra já decidida: com uma proposta aceita, voltar a
  // receber propostas deixaria a cotação com vencedor e concorrentes vivos
  // ao mesmo tempo.
  if (novoStatus === "aberta" && cotacao.status === "fechada") {
    const { data: aceitas, error: aceitasError } = await supabase
      .from("propostas")
      .select("id")
      .eq("cotacao_id", cotacaoId)
      .eq("status", "aceita")
      .limit(1);

    if (aceitasError) {
      throw new BadRequestException(aceitasError.message);
    }

    if ((aceitas ?? []).length > 0) {
      throw new BadRequestException(
        "Esta cotação já tem uma proposta aceita e não pode ser retomada.",
      );
    }
  }

  const { data: updated, error } = await supabase
    .from("cotacoes")
    .update({ status: novoStatus })
    .eq("id", cotacaoId)
    .eq("status", cotacao.status) // optimistic lock
    .select(COTACAO_FIELDS)
    .maybeSingle();

  if (error) {
    throw new BadRequestException(error.message);
  }

  if (!updated) {
    throw new ConflictException("O status da cotação mudou nesse meio tempo — tente novamente.");
  }

  return updated as CotacaoRow;
}

/** Invites a fornecedor by email and/or WhatsApp — creates the
 * fornecedores_convidados row that is the only bridge to the fornecedor
 * side (token_acesso is generated by a DB default). Pelo menos um dos dois
 * contatos precisa estar presente. */
export async function convidarFornecedor(
  adminId: string,
  cotacaoId: string,
  contato: { emailContato?: string; whatsapp?: string; nomeEmpresa?: string },
): Promise<FornecedorConvidadoRow> {
  const cotacao = await fetchCotacaoOrThrow(cotacaoId);

  if (cotacao.admin_id !== adminId) {
    throw new ForbiddenException("Você não é o responsável por esta cotação.");
  }

  const emailContato = contato.emailContato?.trim() || undefined;
  // Gravado sempre na forma canônica (55 + DDD + número, só dígitos) pra que
  // o dedupe e o casamento do lado do fornecedor não dependam do formato.
  const whatsapp = normalizarWhatsapp(contato.whatsapp) ?? undefined;

  if (!emailContato && !whatsapp) {
    throw new BadRequestException("Informe um e-mail ou um WhatsApp para o convite.");
  }

  // Convidar o mesmo contato duas vezes na mesma cotação é sempre um clique
  // repetido, não uma intenção — devolve o convite que já existe (mesmo
  // token_acesso, mesmo link) em vez de duplicar a linha.
  const existente = await buscarConviteExistente(cotacaoId, emailContato, whatsapp);
  if (existente) {
    return existente;
  }

  const { data, error } = await adminClient()
    .from("fornecedores_convidados")
    .insert({
      cotacao_id: cotacaoId,
      // email_contato é NOT NULL no banco — ver convite-contato.util.ts.
      email_contato: emailContato ?? emailSentinelaParaWhatsapp(whatsapp!),
      whatsapp: whatsapp ?? null,
      nome_empresa: contato.nomeEmpresa ?? null,
    })
    .select(CONVIDADO_FIELDS)
    .single();

  if (error || !data) {
    throw new BadRequestException(error?.message ?? "Falha ao convidar fornecedor.");
  }

  return semSentinela(data as FornecedorConvidadoRow);
}

/** Convite já existente nesta cotação pro mesmo e-mail ou telefone (telefone
 * comparado só pelos dígitos, já que o formato digitado varia). */
async function buscarConviteExistente(
  cotacaoId: string,
  emailContato?: string,
  whatsapp?: string,
): Promise<FornecedorConvidadoRow | null> {
  const { data, error } = await adminClient()
    .from("fornecedores_convidados")
    .select(CONVIDADO_FIELDS)
    .eq("cotacao_id", cotacaoId);

  if (error) {
    throw new BadRequestException(error.message);
  }

  const emailAlvo = emailContato?.toLowerCase();
  const digitosAlvo = digitosDoTelefone(whatsapp);

  const encontrado = (data ?? []).find((c) => {
    const mesmoEmail =
      !!emailAlvo && !!c.email_contato && c.email_contato.toLowerCase() === emailAlvo;
    const mesmoWhats = !!digitosAlvo && digitosDoTelefone(c.whatsapp) === digitosAlvo;
    return mesmoEmail || mesmoWhats;
  });

  return encontrado ? semSentinela(encontrado as FornecedorConvidadoRow) : null;
}

/** Busca fornecedores (role 'supplier') para o seletor de convite por
 * WhatsApp — filtra por segmento e/ou termo livre (nome/whatsapp/email). */
export async function buscarFornecedores(
  busca?: string,
  segmentoId?: string,
): Promise<FornecedorUsuarioRow[]> {
  const supabase = adminClient();

  const { data: supplierRole, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("key", "supplier")
    .single();

  if (roleError || !supplierRole) {
    throw new BadRequestException('Role "supplier" não encontrada.');
  }

  let query = supabase
    .from("users")
    .select("id, nome, email, whatsapp, organization_name, segmento_id")
    .eq("role_id", supplierRole.id)
    .order("nome", { ascending: true })
    .limit(50);

  if (segmentoId) {
    query = query.eq("segmento_id", segmentoId);
  }

  const termo = busca?.trim().replace(/[,()]/g, " ");
  if (termo) {
    query = query.or(`nome.ilike.%${termo}%,whatsapp.ilike.%${termo}%,email.ilike.%${termo}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new BadRequestException(error.message);
  }

  return (data ?? []) as FornecedorUsuarioRow[];
}

/** Convite direcionado a usuários específicos (selecionados no modal de
 * WhatsApp) — não duplica convite pra quem já foi convidado nessa
 * cotação (checa email e whatsapp antes de inserir). */
export async function convidarPorUsuarios(
  adminId: string,
  cotacaoId: string,
  userIds: string[],
): Promise<FornecedorConvidadoRow[]> {
  const cotacao = await fetchCotacaoOrThrow(cotacaoId);

  if (cotacao.admin_id !== adminId) {
    throw new ForbiddenException("Você não é o responsável por esta cotação.");
  }

  const supabase = adminClient();

  const { data: supplierRole, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("key", "supplier")
    .single();

  if (roleError || !supplierRole) {
    throw new BadRequestException('Role "supplier" não encontrada.');
  }

  const { data: usuarios, error: usuariosError } = await supabase
    .from("users")
    .select("id, email, whatsapp, organization_name")
    .eq("role_id", supplierRole.id)
    .in("id", userIds);

  if (usuariosError) {
    throw new BadRequestException(usuariosError.message);
  }

  if (!usuarios || usuarios.length === 0) {
    return [];
  }

  const { data: existentes, error: existentesError } = await supabase
    .from("fornecedores_convidados")
    .select("email_contato, whatsapp")
    .eq("cotacao_id", cotacaoId);

  if (existentesError) {
    throw new BadRequestException(existentesError.message);
  }

  const emailsExistentes = new Set(
    (existentes ?? []).map((c) => c.email_contato?.toLowerCase()).filter((v): v is string => !!v),
  );
  // Telefone comparado só pelos dígitos — o mesmo número aparece gravado
  // como "(11) 91234-5678" e "11912345678" dependendo de onde foi digitado.
  const whatsappsExistentes = new Set(
    (existentes ?? []).map((c) => digitosDoTelefone(c.whatsapp)).filter(Boolean),
  );

  const novos = usuarios.filter((u) => {
    const jaEmail = !!u.email && emailsExistentes.has(u.email.toLowerCase());
    const digits = digitosDoTelefone(u.whatsapp);
    const jaWhats = !!digits && whatsappsExistentes.has(digits);
    return !jaEmail && !jaWhats;
  });

  if (novos.length === 0) {
    return [];
  }

  const semContato = novos.filter((u) => !u.email && !u.whatsapp);
  if (semContato.length === novos.length) {
    throw new BadRequestException(
      "Os fornecedores selecionados não têm e-mail nem WhatsApp cadastrado.",
    );
  }

  const { data: criados, error: insertError } = await supabase
    .from("fornecedores_convidados")
    .insert(
      novos
        .filter((u) => u.email || u.whatsapp)
        .map((u) => {
          const whatsapp = normalizarWhatsapp(u.whatsapp);
          return {
            cotacao_id: cotacaoId,
            // email_contato é NOT NULL no banco — ver convite-contato.util.ts.
            email_contato: u.email ?? emailSentinelaParaWhatsapp(whatsapp!),
            whatsapp,
            nome_empresa: u.organization_name ?? null,
          };
        }),
    )
    .select(CONVIDADO_FIELDS);

  if (insertError) {
    throw new BadRequestException(insertError.message);
  }

  return ((criados ?? []) as FornecedorConvidadoRow[]).map(semSentinela);
}

export async function listarConvites(
  adminId: string,
  cotacaoId: string,
): Promise<FornecedorConvidadoRow[]> {
  const cotacao = await fetchCotacaoOrThrow(cotacaoId);

  if (cotacao.admin_id !== adminId) {
    throw new ForbiddenException("Você não é o responsável por esta cotação.");
  }

  const { data, error } = await adminClient()
    .from("fornecedores_convidados")
    .select(CONVIDADO_FIELDS)
    .eq("cotacao_id", cotacaoId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new BadRequestException(error.message);
  }

  return ((data ?? []) as FornecedorConvidadoRow[]).map(semSentinela);
}
