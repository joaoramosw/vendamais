'use server'

/**
 * Série temporal de preço de um produto — alimenta a seção "Histórico" da
 * página do produto (gráfico, ofertas por data e simulador).
 *
 * Mora em Server Action e não no backend NestJS de propósito: o domínio de
 * produtos inteiro vive aqui (`src/actions/products.ts`); só cotações/propostas
 * migraram pro Nest.
 *
 * DEGRADAÇÃO: as duas fontes que dependem de migration recente
 * (`product_price_history` = 019, `proposta_itens.product_id` = 020) são
 * consultadas de forma tolerante. Se a migration ainda não rodou no banco — o
 * padrão de divergência já documentado no CLAUDE.md — a fonte simplesmente não
 * entra e a resposta diz isso em `fontes`, para a UI explicar em vez de mentir.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ensureUser } from '@/lib/supabase/ensure-user'
import { redirect } from 'next/navigation'
import {
  chaveBucket,
  GRANULARIDADE_SEMANAL,
  historicoVazio,
  PERIODO_DIAS,
  PERIODOS,
  type HistoricoProduto,
  type OfertaHistorico,
  type PeriodoHistorico,
  type PontoHistorico,
} from '@/lib/historico-produto'

export async function getHistoricoProduto(
  productId: string,
  periodo: PeriodoHistorico = '30d',
): Promise<HistoricoProduto> {
  if (!PERIODOS.includes(periodo)) periodo = '30d'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const userRow = await ensureUser(supabase, user)
  if (userRow?.role !== 'admin') redirect('/fornecedor/dashboard')

  // `products` é RLS-locked contra a tabela `profiles` legada — leitura pelo
  // client admin, igual ao resto do módulo (gotcha #21 do CLAUDE.md).
  const admin = createAdminClient()

  const semanal = GRANULARIDADE_SEMANAL.includes(periodo)
  const desde = new Date()
  desde.setUTCDate(desde.getUTCDate() - PERIODO_DIAS[periodo])
  desde.setUTCHours(0, 0, 0, 0)
  const desdeIso = desde.toISOString()

  const { data: produto, error: produtoError } = await admin
    .from('products')
    .select('id, price_unit_store')
    .eq('id', productId)
    .is('deleted_at', null)
    .maybeSingle()

  if (produtoError) return historicoVazio(periodo, produtoError.message)
  if (!produto) return historicoVazio(periodo, 'Produto não encontrado.')

  const precoLojaAtual =
    produto.price_unit_store != null && produto.price_unit_store > 0
      ? produto.price_unit_store
      : null

  // ── Fonte 1: cotações de referência (product_quotes) ──────────────────────
  const { data: quotes, error: quotesError } = await admin
    .from('product_quotes')
    .select('id, company_name, price, created_at')
    .eq('product_id', productId)
    .gte('created_at', desdeIso)
    .order('created_at', { ascending: true })

  if (quotesError) return historicoVazio(periodo, quotesError.message)

  const ofertas: OfertaHistorico[] = (quotes ?? []).map((q) => ({
    id: q.id,
    empresa: q.company_name,
    valor: Number(q.price),
    data: q.created_at,
    cotacao_id: null,
  }))

  // ── Fonte 2: ofertas reais das cotações (migration 020) ───────────────────
  let ofertasDeCotacao = true
  const { data: itensProposta, error: itensError } = await admin
    .from('proposta_itens')
    .select('id, preco_unitario, created_at, disponivel, proposta_id')
    .eq('product_id', productId)
    .gte('created_at', desdeIso)

  if (itensError) {
    // 42703 = coluna não existe → migration 020 pendente. Qualquer outro erro
    // também não deve derrubar a seção inteira; só perde esta fonte.
    ofertasDeCotacao = false
  } else if (itensProposta && itensProposta.length > 0) {
    const propostaIds = [...new Set(itensProposta.map((i) => i.proposta_id))]
    const { data: propostas } = await admin
      .from('propostas')
      .select('id, cotacao_id, fornecedor_convidado_id')
      .in('id', propostaIds)

    const convidadoIds = [
      ...new Set((propostas ?? []).map((p) => p.fornecedor_convidado_id).filter(Boolean)),
    ]
    const { data: convidados } = await admin
      .from('fornecedores_convidados')
      .select('id, nome_empresa, email_contato')
      .in('id', convidadoIds)

    const convidadoById = new Map((convidados ?? []).map((c) => [c.id, c]))
    const propostaById = new Map((propostas ?? []).map((p) => [p.id, p]))

    for (const item of itensProposta) {
      // "Não tenho" grava preço 0 — não é oferta, não entra no melhor preço.
      if (item.disponivel === false || !item.preco_unitario) continue
      const proposta = propostaById.get(item.proposta_id)
      const convidado = proposta ? convidadoById.get(proposta.fornecedor_convidado_id) : null
      ofertas.push({
        id: item.id,
        empresa: convidado?.nome_empresa || convidado?.email_contato || 'Fornecedor',
        valor: Number(item.preco_unitario),
        data: item.created_at,
        cotacao_id: proposta?.cotacao_id ?? null,
      })
    }
  }

  // ── Fonte 3: histórico do preço de loja (migration 019) ───────────────────
  let historicoPrecoLoja = true
  const { data: precos, error: precosError } = await admin
    .from('product_price_history')
    .select('price_unit_store, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  if (precosError) historicoPrecoLoja = false

  // ── Agregação em buckets ──────────────────────────────────────────────────
  const porBucket = new Map<string, OfertaHistorico[]>()
  for (const oferta of ofertas) {
    const chave = chaveBucket(oferta.data, semanal)
    const lista = porBucket.get(chave)
    if (lista) lista.push(oferta)
    else porBucket.set(chave, [oferta])
  }

  // Eixo X contínuo: um ponto por bucket do período, mesmo sem oferta. Sem
  // isso o gráfico comprime o tempo e sugere variação que não houve.
  const chaves: string[] = []
  const cursor = new Date(desde)
  const hoje = new Date()
  hoje.setUTCHours(0, 0, 0, 0)
  const passo = semanal ? 7 : 1
  // Alinha o cursor no início do bucket para os rótulos baterem com as chaves.
  cursor.setUTCDate(cursor.getUTCDate() - (semanal ? (cursor.getUTCDay() + 6) % 7 : 0))
  while (cursor <= hoje) {
    chaves.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + passo)
  }

  const pontos: PontoHistorico[] = chaves.map((chave) => {
    const doBucket = (porBucket.get(chave) ?? []).slice().sort((a, b) => a.valor - b.valor)
    const fimBucket = new Date(chave)
    fimBucket.setUTCDate(fimBucket.getUTCDate() + passo)

    // Carry-forward: o preço de loja é um valor que VIGORA até mudar, então o
    // ponto é o último snapshot registrado até o fim do bucket — não só os
    // registrados dentro dele.
    let precoLoja: number | null = null
    if (historicoPrecoLoja) {
      for (const p of precos ?? []) {
        if (new Date(p.created_at) < fimBucket) precoLoja = Number(p.price_unit_store)
        else break
      }
    }

    return {
      data: chave,
      preco_loja: precoLoja,
      melhor_oferta: doBucket.length > 0 ? doBucket[0].valor : null,
      ofertas: doBucket,
    }
  })

  // Ofertas "atuais": as do bucket mais recente que teve oferta.
  const ultimoComOferta = [...pontos].reverse().find((p) => p.ofertas.length > 0)

  return {
    periodo,
    granularidade: semanal ? 'semana' : 'dia',
    pontos,
    ofertasAtuais: ultimoComOferta?.ofertas ?? [],
    precoLojaAtual,
    fontes: { historicoPrecoLoja, ofertasDeCotacao },
    error: null,
  }
}
