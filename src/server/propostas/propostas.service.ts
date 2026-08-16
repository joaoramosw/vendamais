import "server-only";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/server/http";
import { adminClient } from "@/server/supabase";
import type { EnviarPropostaInput } from "./dto";
import type { PropostaItemRow, PropostaRow } from "./propostas.types";
import type { CotacaoItemRow, CotacaoRow } from "../cotacoes/cotacoes.types";
import { calcularRankingPorItem, type ItemResultado } from "./ranking-por-item.util";
import { montarItensConvite } from "./convite-itens.util";
import { isEmailSentinela } from "../cotacoes/convite-contato.util";
import {
  markRespondido,
  markVisualizado,
  resolveConvite,
  validateTokenForSubmission,
  vincularUsuario,
  type FornecedorConvidado,
} from "./fornecedor-token.service";

/**
 * Domínio de propostas — conversão 1:1 do `PropostasService` do NestJS.
 * Os probes de coluna de migration viraram estado de módulo (otimização por
 * instância; probe extra num cold start é aceitável e inofensivo).
 */

/** Re-teste da coluna `propostas.observacao` (migration 023) depois de um
 * negativo — rodar a migration passa a valer sem redeploy. */
const OBSERVACAO_PROBE_TTL_MS = 60_000;

/** Mesmo intervalo para `proposta_itens.product_id` (migration 020). */
const PRODUCT_ID_PROBE_TTL_MS = 60_000;

let observacaoSuportada: boolean | null = null;
let observacaoProbeAt = 0;

let productIdSuportado: boolean | null = null;
let productIdProbeAt = 0;

/**
 * A coluna `propostas.observacao` ("Observações gerais" do fornecedor) só
 * existe depois da migration 023. Enquanto ela não roda, pedir a coluna num
 * `select` derruba a query inteira e gravá-la derruba o envio — por isso o
 * teste é feito uma vez e memorizado, com re-teste a cada 60s.
 */
async function observacaoGeralDisponivel(): Promise<boolean> {
  if (observacaoSuportada === true) return true;
  if (observacaoSuportada === false && Date.now() - observacaoProbeAt < OBSERVACAO_PROBE_TTL_MS) {
    return false;
  }

  const { error } = await adminClient().from("propostas").select("observacao").limit(1);

  observacaoProbeAt = Date.now();
  observacaoSuportada = !error;

  if (error) {
    console.warn(
      `propostas.observacao indisponível (${error.code ?? "?"}): ${error.message}. ` +
        "Rode supabase/migrations/023_proposta_observacao_geral.sql.",
    );
  }

  return observacaoSuportada;
}

/**
 * A coluna `proposta_itens.product_id` (migration 020) liga a oferta ao
 * produto do catálogo — só a ponte para o histórico de preço; nada do fluxo
 * de proposta depende dela. Sem este teste, mandá-la num banco sem a
 * migration derruba o envio inteiro com PGRST204 depois de o fornecedor
 * preencher tudo e confirmar a senha.
 */
async function productIdEmItemDisponivel(): Promise<boolean> {
  if (productIdSuportado === true) return true;
  if (productIdSuportado === false && Date.now() - productIdProbeAt < PRODUCT_ID_PROBE_TTL_MS) {
    return false;
  }

  const { error } = await adminClient().from("proposta_itens").select("product_id").limit(1);

  productIdProbeAt = Date.now();
  productIdSuportado = !error;

  if (error) {
    console.warn(
      `proposta_itens.product_id indisponível (${error.code ?? "?"}): ${error.message}. ` +
        "Rode supabase/migrations/020_proposta_item_product_id.sql — " +
        "sem ela a proposta é gravada normalmente, só sem o vínculo com o catálogo.",
    );
  }

  return productIdSuportado;
}

/**
 * Colunas de `propostas`. Tipado como `string` (não literal) de propósito:
 * o parser do supabase-js só entende select literal, e aqui a lista depende
 * de a migration 023 ter rodado ou não.
 */
function propostaFields(comObservacao: boolean): string {
  const base =
    "id, cotacao_id, fornecedor_convidado_id, status, valor_total, prazo_entrega, created_at";
  return comObservacao ? `${base}, observacao` : base;
}

/**
 * Dados que o fornecedor vê antes de responder — GET /api/convite/[identificador].
 *
 * `identificador` é o token do convite **ou** o id de uma proposta já
 * enviada: a rota pública é `/proposta/{id}` e os dois formatos precisam
 * abrir a mesma tela (ver fornecedor-token.service#resolveConvite).
 */
export async function getConvite(identificador: string) {
  const convidado = await resolveConvite(identificador);
  return montarPayloadConvite(convidado);
}

/**
 * Fluxo de acesso via link com sessão (Cenário A/B): garante que a conta
 * logada faz parte da cotação e devolve o convite **dela** — criando um se
 * for preciso (ver fornecedor-token.service#vincularUsuario).
 */
export async function acessarComoUsuario(
  identificador: string,
  usuario: { email: string | null; whatsapp: string | null; nomeEmpresa?: string | null },
) {
  const original = await resolveConvite(identificador);
  const { convite, criado } = await vincularUsuario(original, usuario);

  const payload = await montarPayloadConvite(convite);
  return { ...payload, vinculo_criado: criado };
}

async function montarPayloadConvite(convidado: FornecedorConvidado) {
  await markVisualizado(convidado);
  const supabase = adminClient();

  const { data: cotacao, error: cotacaoError } = await supabase
    .from("cotacoes")
    .select("id, titulo, status, data_limite, created_at")
    .eq("id", convidado.cotacao_id)
    .maybeSingle();

  if (cotacaoError || !cotacao) {
    throw new NotFoundException("Cotação não encontrada.");
  }

  // Quantidade NÃO vai pro fornecedor (ele só informa preço por unidade do
  // produto). Unidade (CX, UN, ...) vai sim — o fornecedor precisa saber em
  // cima de que unidade está informando o preço.
  const { data: itens, error: itensError } = await supabase
    .from("cotacao_itens")
    .select("id, nome_produto, unidade, observacao, product_id")
    .eq("cotacao_id", convidado.cotacao_id);

  if (itensError) {
    throw new BadRequestException(itensError.message);
  }

  const productIds = [...new Set((itens ?? []).map((i) => i.product_id).filter(Boolean))];
  let imagemPorProductId = new Map<string, string | null>();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, image_url")
      .in("id", productIds);

    if (productsError) {
      throw new BadRequestException(productsError.message);
    }

    imagemPorProductId = new Map((products ?? []).map((p) => [p.id, p.image_url]));
  }

  const itensComImagem = montarItensConvite(itens ?? [], imagemPorProductId);

  // Convite já respondido: o front precisa do id da proposta pra mandar a
  // pessoa pra "Minhas Propostas" em vez de mostrar um erro seco.
  const { data: propostaExistente } = await supabase
    .from("propostas")
    .select("id")
    .eq("fornecedor_convidado_id", convidado.id)
    .maybeSingle();

  return {
    cotacao,
    itens: itensComImagem,
    convite: {
      // Token do convite **desta pessoa** — pode ser diferente do
      // identificador da URL (link repassado, id de proposta antiga).
      token_acesso: convidado.token_acesso,
      status_convite: convidado.status_convite,
      // Convite só por WhatsApp carrega um e-mail-sentinela no banco
      // (email_contato é NOT NULL lá) — nunca vaza pra fora da API.
      email_contato: isEmailSentinela(convidado.email_contato) ? null : convidado.email_contato,
      whatsapp: convidado.whatsapp,
      nome_empresa: convidado.nome_empresa,
    },
    proposta_id: propostaExistente?.id ?? null,
    observacao_geral_suportada: await observacaoGeralDisponivel(),
  };
}

export async function enviarProposta(dto: EnviarPropostaInput): Promise<PropostaRow> {
  const convidado = await validateTokenForSubmission(dto.token_acesso);
  const supabase = adminClient();

  const cotacao = await fetchCotacaoOrThrow(convidado.cotacao_id);
  if (cotacao.status !== "aberta") {
    throw new BadRequestException(
      `Cotação está com status "${cotacao.status}" e não aceita novas propostas.`,
    );
  }

  // O fornecedor só informa preço por unidade — nome do produto e
  // quantidade vêm do item real da cotação (nunca digitados por ele),
  // buscados aqui pra calcular valor_total corretamente.
  const cotacaoItemIds = dto.itens.map((item) => item.cotacao_item_id);
  const { data: cotacaoItens, error: cotacaoItensError } = await supabase
    .from("cotacao_itens")
    .select("id, nome_produto, quantidade, product_id")
    .eq("cotacao_id", convidado.cotacao_id)
    .in("id", cotacaoItemIds);

  if (cotacaoItensError) {
    throw new BadRequestException(cotacaoItensError.message);
  }

  const cotacaoItemById = new Map((cotacaoItens ?? []).map((i) => [i.id, i]));

  for (const item of dto.itens) {
    if (!cotacaoItemById.has(item.cotacao_item_id)) {
      throw new BadRequestException("Um dos itens enviados não pertence a esta cotação.");
    }
  }

  const valorTotal = dto.itens.reduce((total, item) => {
    if (item.disponivel === false) return total;
    const cotacaoItem = cotacaoItemById.get(item.cotacao_item_id)!;
    return total + cotacaoItem.quantidade * item.preco_unitario;
  }, 0);

  // "Observações gerais" vale pra proposta inteira (≠ observação por item) e
  // só existe depois da migration 023 — sem ela, a proposta é gravada igual,
  // apenas sem esse campo.
  const comObservacao = await observacaoGeralDisponivel();
  const observacaoGeral = dto.observacao?.trim() || null;

  const { data: proposta, error: propostaError } = await supabase
    .from("propostas")
    .insert({
      cotacao_id: convidado.cotacao_id,
      fornecedor_convidado_id: convidado.id,
      status: "enviada",
      valor_total: valorTotal,
      prazo_entrega: dto.prazo_entrega ?? null,
      ...(comObservacao ? { observacao: observacaoGeral } : {}),
    })
    .select(propostaFields(comObservacao))
    .single<PropostaRow>();

  if (propostaError || !proposta) {
    throw new BadRequestException(propostaError?.message ?? "Falha ao registrar proposta.");
  }

  // Vínculo com o catálogo é opcional (migration 020) — a proposta é o que
  // não pode falhar. Ver productIdEmItemDisponivel.
  const comProductId = await productIdEmItemDisponivel();

  const itensPayload = dto.itens.map((item) => {
    const cotacaoItem = cotacaoItemById.get(item.cotacao_item_id)!;
    const disponivel = item.disponivel ?? true;
    return {
      proposta_id: proposta.id,
      produto_nome: cotacaoItem.nome_produto,
      quantidade: cotacaoItem.quantidade,
      // "Não tenho" sempre grava preço 0, independente do que veio no
      // payload — evita que um preço residual digitado antes de marcar
      // "não tenho" seja levado em conta no ranking.
      preco_unitario: disponivel ? item.preco_unitario : 0,
      observacao: item.observacao ?? null,
      disponivel,
      // Liga a oferta ao produto do catálogo (migration 020). `produto_nome`
      // continua sendo o texto congelado no envio — o id é só a ponte pro
      // histórico de preço da página do produto.
      ...(comProductId ? { product_id: cotacaoItem.product_id ?? null } : {}),
    };
  });

  const { error: itensError } = await supabase.from("proposta_itens").insert(itensPayload);

  if (itensError) {
    const { error: rollbackError } = await supabase
      .from("propostas")
      .delete()
      .eq("id", proposta.id);

    if (rollbackError) {
      console.error(
        `Failed to roll back orphan proposta ${proposta.id}: ${rollbackError.message}`,
      );
    }

    throw new BadRequestException(itensError.message);
  }

  await markRespondido(convidado, dto.whatsapp, dto.nome_empresa);

  return proposta as PropostaRow;
}

/** Propostas for a cotacao, enriched with their itens and the fornecedor's
 * contact info (via fornecedores_convidados — there is no profiles/users
 * link, this is the only identifying info available for a fornecedor). */
export async function listarPorCotacao(
  adminId: string,
  cotacaoId: string,
): Promise<
  Array<
    PropostaRow & {
      itens: PropostaItemRow[];
      email_contato: string | null;
      whatsapp: string | null;
      nome_empresa: string | null;
    }
  >
> {
  await assertCotacaoOwnership(adminId, cotacaoId);
  const supabase = adminClient();

  const { data, error } = await supabase
    .from("propostas")
    .select(propostaFields(await observacaoGeralDisponivel()))
    .eq("cotacao_id", cotacaoId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new BadRequestException(error.message);
  }

  // `as unknown` no meio: com select dinâmico o supabase-js não infere a
  // forma da linha.
  const propostas = (data ?? []) as unknown as PropostaRow[];
  if (propostas.length === 0) return [];

  const propostaIds = propostas.map((p) => p.id);
  const convidadoIds = [...new Set(propostas.map((p) => p.fornecedor_convidado_id))];

  const { data: itens, error: itensError } = await supabase
    .from("proposta_itens")
    .select("id, proposta_id, produto_nome, quantidade, preco_unitario, observacao, disponivel, created_at")
    .in("proposta_id", propostaIds);

  if (itensError) {
    throw new BadRequestException(itensError.message);
  }

  // Lista enviada pelo fornecedor também deve estar em ordem alfabética.
  const itensOrdenados = ((itens ?? []) as PropostaItemRow[]).sort((a, b) =>
    a.produto_nome.localeCompare(b.produto_nome, "pt-BR"),
  );

  const { data: convidados, error: convidadosError } = await supabase
    .from("fornecedores_convidados")
    .select("id, email_contato, whatsapp, nome_empresa")
    .in("id", convidadoIds);

  if (convidadosError) {
    throw new BadRequestException(convidadosError.message);
  }

  const convidadoById = new Map((convidados ?? []).map((c) => [c.id, c]));

  return propostas.map((proposta) => {
    const convidado = convidadoById.get(proposta.fornecedor_convidado_id);
    return {
      ...proposta,
      itens: itensOrdenados.filter((item) => item.proposta_id === proposta.id),
      email_contato: isEmailSentinela(convidado?.email_contato)
        ? null
        : convidado?.email_contato ?? null,
      whatsapp: convidado?.whatsapp ?? null,
      nome_empresa: convidado?.nome_empresa ?? null,
    };
  });
}

/**
 * Resultado por item — vencedor/2º/3º colocado, menor preço vence (ver
 * ranking-por-item.util.ts). Gate: só calcula/retorna com a cotação
 * publicada ('aberta', resultado parcial) ou 'fechada' (resultado final).
 */
export async function resultadoPorItem(
  adminId: string,
  cotacaoId: string,
): Promise<{ cotacao: CotacaoRow; itens: ItemResultado[] }> {
  const cotacao = await fetchCotacaoOrThrow(cotacaoId);

  if (cotacao.admin_id !== adminId) {
    throw new ForbiddenException("Você não é o responsável por esta cotação.");
  }

  if (cotacao.status !== "fechada" && cotacao.status !== "aberta") {
    throw new BadRequestException(
      "O resultado da cotação só fica disponível depois que a cotação é publicada.",
    );
  }

  const { data: itens, error: itensError } = await adminClient()
    .from("cotacao_itens")
    .select(
      "id, cotacao_id, nome_produto, unidade, quantidade, observacao, codigo_barras, categoria, product_id, descricao, estoque_atual, quantidade_sugerida, tipo_unidade, preco_unitario_manual, preco_manual",
    )
    .eq("cotacao_id", cotacaoId);

  if (itensError) {
    throw new BadRequestException(itensError.message);
  }

  const propostasComItens = await listarPorCotacao(adminId, cotacaoId);

  const itensOrdenados = ((itens ?? []) as CotacaoItemRow[]).sort((a, b) =>
    a.nome_produto.localeCompare(b.nome_produto, "pt-BR"),
  );

  const precoLojaPorProduto = await carregarPrecosDeLoja(itensOrdenados);

  const resultado = calcularRankingPorItem(itensOrdenados, propostasComItens, precoLojaPorProduto);

  return { cotacao, itens: resultado };
}

/**
 * Preço de loja (`products.price_unit_store`) dos itens que vieram do
 * catálogo — base do "valor ideal de compra" na tabela de comparação.
 * Falha de leitura não derruba o resultado: sem os preços, a coluna
 * "Preço loja" fica vazia, mas o ranking continua respondendo.
 */
async function carregarPrecosDeLoja(itens: CotacaoItemRow[]): Promise<Map<string, number>> {
  const productIds = [...new Set(itens.map((i) => i.product_id).filter((id): id is string => !!id))];
  if (productIds.length === 0) return new Map();

  const { data, error } = await adminClient()
    .from("products")
    .select("id, price_unit_store")
    .in("id", productIds);

  if (error) {
    console.warn(`Falha ao carregar preços de loja: ${error.message}`);
    return new Map();
  }

  return new Map(
    ((data ?? []) as Array<{ id: string; price_unit_store: number | null }>).map((p) => [
      p.id,
      Number(p.price_unit_store ?? 0),
    ]),
  );
}

export async function getPropostaComItens(
  adminId: string,
  propostaId: string,
): Promise<{ proposta: PropostaRow; itens: PropostaItemRow[] }> {
  const proposta = await fetchPropostaOrThrow(propostaId);
  await assertCotacaoOwnership(adminId, proposta.cotacao_id);

  const { data: itens, error } = await adminClient()
    .from("proposta_itens")
    .select("id, proposta_id, produto_nome, quantidade, preco_unitario, observacao, disponivel, created_at")
    .eq("proposta_id", propostaId);

  if (error) {
    throw new BadRequestException(error.message);
  }

  return { proposta, itens: (itens ?? []) as PropostaItemRow[] };
}

/** Accept: closes the cotacao (optimistic lock) and rejects sibling
 * propostas. Reject: just flips this proposta's status. */
export async function gerenciarProposta(
  adminId: string,
  propostaId: string,
  novoStatus: "aceita" | "recusada",
): Promise<PropostaRow> {
  const proposta = await fetchPropostaOrThrow(propostaId);
  await assertCotacaoOwnership(adminId, proposta.cotacao_id);

  if (proposta.status !== "enviada") {
    throw new BadRequestException(
      `Proposta está com status "${proposta.status}" e não pode ser alterada.`,
    );
  }

  if (novoStatus === "recusada") {
    return updatePropostaStatus(propostaId, "recusada");
  }

  const supabase = adminClient();

  // Accept: claim the cotacao first — only one concurrent "aceitar" wins.
  const { data: claimedCotacao, error: claimError } = await supabase
    .from("cotacoes")
    .update({ status: "fechada" })
    .eq("id", proposta.cotacao_id)
    .eq("status", "aberta")
    .select("id")
    .maybeSingle();

  if (claimError) {
    throw new BadRequestException(claimError.message);
  }

  if (!claimedCotacao) {
    throw new ConflictException("Esta cotação já foi encerrada por outra ação.");
  }

  const accepted = await updatePropostaStatus(propostaId, "aceita");

  const { error: rejectSiblingsError } = await supabase
    .from("propostas")
    .update({ status: "recusada" })
    .eq("cotacao_id", proposta.cotacao_id)
    .eq("status", "enviada")
    .neq("id", propostaId);

  if (rejectSiblingsError) {
    // Known limitation: if this fails, the acceptance itself is unaffected,
    // but sibling propostas may stay 'enviada' incorrectly. Logged, not fatal.
    console.error(
      `Failed to reject sibling propostas for cotacao ${proposta.cotacao_id}: ${rejectSiblingsError.message}`,
    );
  }

  return accepted;
}

/** Optimistic lock on the proposta itself — .eq('status','enviada') here
 * so two concurrent actions on the same proposta can't both succeed. */
async function updatePropostaStatus(
  propostaId: string,
  status: "aceita" | "recusada",
): Promise<PropostaRow> {
  const { data, error } = await adminClient()
    .from("propostas")
    .update({ status })
    .eq("id", propostaId)
    .eq("status", "enviada")
    .select("id, cotacao_id, fornecedor_convidado_id, status, valor_total, prazo_entrega, created_at")
    .maybeSingle();

  if (error) {
    throw new BadRequestException(error.message);
  }

  if (!data) {
    throw new ConflictException("Esta proposta já foi alterada por outra ação.");
  }

  return data as PropostaRow;
}

async function fetchPropostaOrThrow(propostaId: string): Promise<PropostaRow> {
  const { data, error } = await adminClient()
    .from("propostas")
    .select("id, cotacao_id, fornecedor_convidado_id, status, valor_total, prazo_entrega, created_at")
    .eq("id", propostaId)
    .maybeSingle();

  if (error || !data) {
    throw new NotFoundException("Proposta não encontrada.");
  }

  return data as PropostaRow;
}

async function fetchCotacaoOrThrow(cotacaoId: string): Promise<CotacaoRow> {
  const { data, error } = await adminClient()
    .from("cotacoes")
    .select("id, admin_id, titulo, status, data_abertura, data_fechamento, created_at, data_limite")
    .eq("id", cotacaoId)
    .maybeSingle();

  if (error || !data) {
    throw new NotFoundException("Cotação não encontrada.");
  }

  return data as CotacaoRow;
}

async function assertCotacaoOwnership(adminId: string, cotacaoId: string): Promise<void> {
  const cotacao = await fetchCotacaoOrThrow(cotacaoId);
  if (cotacao.admin_id !== adminId) {
    throw new ForbiddenException("Você não é o responsável por esta cotação.");
  }
}
