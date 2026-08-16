'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  getCotacaoVisibilityScope,
  assertCotacaoOwnership,
  assertCanFinalizarCotacao,
} from '@/lib/authorization'
import type { CotacaoStatus } from '@/lib/constants'

const VALID_UNIT_TYPES = new Set(['UN', 'CX', 'DZ', 'FD'])

// ─────────────────────────────────────────────────────────────────────────────
// Read actions
// ─────────────────────────────────────────────────────────────────────────────

export async function getCotacoes() {
  const supabase = await createClient()

  // RBAC: vendedores see only quotations they personally created.
  // All other membership roles (owner, admin, member) see everything.
  const { restricted, userId } = await getCotacaoVisibilityScope()

  let query = supabase
    .from('cotacoes')
    .select(`
      *,
      profiles:admin_id (nome, empresa),
      cotacao_itens (*),
      propostas (id)
    `)
    .order('created_at', { ascending: false })

  if (restricted) {
    query = query.eq('admin_id', userId)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data
}

// NOTE: the `propostas`/`proposta_itens` embed below still references
// fornecedor_id / cotacao_item_id, which do not exist on the live schema
// (real columns are `fornecedor_convidado_id` and free-text `produto_nome` —
// see CLAUDE.md "Known Issues"). Reading a cotação's received propostas is
// broken until that flow is rebuilt; only cotação creation/listing was
// fixed in this round.
export async function getCotacao(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cotacoes')
    .select(`
      *,
      profiles:admin_id (nome, empresa),
      cotacao_itens (*),
      propostas (
        *,
        profiles:fornecedor_id (nome, empresa),
        proposta_itens (
          *,
          cotacao_itens:cotacao_item_id (nome_produto, unidade, tipo_unidade, quantidade, quantidade_sugerida)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Supplier-safe version — omits internal fields (estoque_atual, quantidade_sugerida)
export async function getCotacaoParaFornecedor(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cotacoes')
    .select(`
      id, titulo, status, data_limite, created_at,
      profiles:admin_id (nome, empresa),
      cotacao_itens (
        id, nome_produto, descricao, codigo_barras, categoria, tipo_unidade, quantidade, observacao,
        products (image_url)
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function buscarProdutoPorBarcode(barcode: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('products')
    .select('id, name, description, barcode, category, image_url, price_unit_store')
    .eq('barcode', barcode)
    .maybeSingle()

  return data
}

/** Autocomplete leve por nome — usado no formulário de nova cotação
 * enquanto o usuário digita, sem a paginação pesada de getProducts. */
export async function buscarProdutosPorNome(query: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const { data } = await supabase
    .from('products')
    .select('id, name, description, barcode, category, image_url')
    .ilike('name', `%${trimmed}%`)
    .limit(8)

  return data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Write actions
// ─────────────────────────────────────────────────────────────────────────────

interface ItemCotacao {
  nome_produto: string
  descricao?: string
  codigo_barras?: string
  categoria?: string
  estoque_atual?: number
  quantidade_sugerida?: number
  tipo_unidade: 'UN' | 'CX' | 'DZ' | 'FD'
  quantidade: number
  observacao?: string
  product_id?: string
}

type CreateCotacaoResult =
  | { error: string }
  | { success: true; id: string; status: CotacaoStatus }

/**
 * Creates a new quotation with status 'rascunho' (draft).
 * The quotation is NOT visible to suppliers until published.
 *
 * @param formData Form data containing titulo, descricao, data_limite, itens (JSON)
 * @param publish If true, creates directly as 'aberta' (visible to suppliers)
 */
export async function criarCotacao(formData: FormData, publish = false): Promise<CreateCotacaoResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Explicit domain guard — also enforced by RLS ("Empresário cria cotação" policy),
  // but we fail fast here for a better DX and cleaner error messages.
  const { data: profile } = await supabase
    .from('profiles')
    .select('tipo')
    .eq('id', user.id)
    .single()

  if (profile?.tipo !== 'empresario') {
    console.error(
      '[criarCotacao] Access denied: user %s has tipo="%s", expected "empresario"',
      user.id,
      profile?.tipo ?? 'undefined'
    )
    return { error: 'Apenas empresários podem criar cotações.' }
  }

  const titulo = formData.get('titulo') as string
  const descricao = formData.get('descricao') as string
  const dataLimite = formData.get('data_limite') as string

  if (!titulo?.trim()) {
    return { error: 'Título é obrigatório.' }
  }

  // Parse itens from FormData
  const itensJson = formData.get('itens') as string
  let itens: ItemCotacao[] = []

  try {
    itens = JSON.parse(itensJson || '[]')
  } catch {
    return { error: 'Formato de itens inválido.' }
  }

  if (itens.length === 0) {
    return { error: 'Adicione pelo menos um item à cotação.' }
  }

  const invalidItem = itens.find((item) => {
    const nome = item.nome_produto?.trim()
    const quantidade = Number(item.quantidade)
    return !nome || !Number.isFinite(quantidade) || quantidade <= 0
  })

  if (invalidItem) {
    return { error: 'Todos os itens precisam ter nome e quantidade maior que zero.' }
  }

  const invalidUnit = itens.find(
    (item) => !item.tipo_unidade || !VALID_UNIT_TYPES.has(item.tipo_unidade)
  )

  if (invalidUnit) {
    return { error: 'Unidade comercial inválida em um ou mais itens da cotação.' }
  }

  // Determine initial status
  const initialStatus: CotacaoStatus = publish ? 'aberta' : 'rascunho'

  // NOTE: `cotacoes` has no `descricao` column on the live schema — the
  // form field is kept for UX but is not persisted at the cotação level
  // (see CLAUDE.md "Known Issues"). Item-level `descricao` still works.
  void descricao

  const insertPayload: Record<string, unknown> = {
    admin_id: user.id,
    titulo,
    status: initialStatus,
  }

  if (dataLimite) {
    insertPayload.data_limite = dataLimite
  }

  const { data: cotacao, error: cotacaoError } = await supabase
    .from('cotacoes')
    .insert(insertPayload)
    .select('id')
    .single()

  if (cotacaoError) return { error: cotacaoError.message }

  // Insert itens
  const { data: insertedItens, error: itensError } = await supabase.from('cotacao_itens').insert(
    itens.map((item) => ({
      cotacao_id: cotacao.id,
      nome_produto: item.nome_produto,
      descricao: item.descricao || null,
      unidade: (item.tipo_unidade || 'UN').toLowerCase(), // backward compat
      tipo_unidade: item.tipo_unidade || 'UN',
      quantidade: item.quantidade,
      codigo_barras: item.codigo_barras || null,
      categoria: item.categoria || null,
      estoque_atual: item.estoque_atual ?? null,
      quantidade_sugerida: item.quantidade_sugerida ?? item.quantidade,
      observacao: item.observacao || null,
      product_id: item.product_id || null,
    }))
  ).select('id')

  if (itensError) {
    // Cotação was created but items failed — delete the orphan cotação
    await supabase.from('cotacoes').delete().eq('id', cotacao.id)
    return { error: `Erro ao inserir itens: ${itensError.message}` }
  }

  if (!insertedItens || insertedItens.length === 0) {
    // RLS or silent failure — items were not actually persisted
    await supabase.from('cotacoes').delete().eq('id', cotacao.id)
    return { error: 'Nenhum item foi inserido. Verifique as permissões do banco de dados.' }
  }

  revalidatePath('/empresario/cotacoes')
  revalidatePath('/empresario/lista-cotacao')
  revalidatePath('/empresario/dashboard')

  if (publish) {
    revalidatePath('/fornecedor/cotacoes')
    revalidatePath('/fornecedor/dashboard')
  }

  return { success: true, id: cotacao.id, status: initialStatus }
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish a draft quotation — makes it visible to suppliers
// ─────────────────────────────────────────────────────────────────────────────

type PublishQuoteResult =
  | {
      success: true
      cotacaoId: string
      status: string
      message: string
    }
  | {
      success: false
      error: string
    }

/**
 * Publishes a draft quotation, changing its status from 'rascunho' to 'aberta'.
 * After publication, suppliers can see and respond to the quotation.
 *
 * Validates:
 * - User is authenticated and is an empresário
 * - User owns the quotation
 * - Quotation is currently in 'rascunho' status
 * - Quotation has at least 1 valid item
 *
 * Idempotent: calling on an already-published quotation returns success without side effects.
 */
export async function publicarCotacao(cotacaoId: string): Promise<PublishQuoteResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' }
  }

  // Validate role
  const { data: profile } = await supabase
    .from('profiles')
    .select('tipo')
    .eq('id', user.id)
    .single()

  if (profile?.tipo !== 'empresario') {
    return { success: false, error: 'Apenas empresários podem publicar cotações.' }
  }

  // Fetch cotação with items count
  const { data: cotacao, error: fetchError } = await supabase
    .from('cotacoes')
    .select('id, admin_id, status, cotacao_itens (id)')
    .eq('id', cotacaoId)
    .single()

  if (fetchError || !cotacao) {
    return { success: false, error: 'Cotação não encontrada.' }
  }

  // Validate ownership
  if (cotacao.admin_id !== user.id) {
    return { success: false, error: 'Você não é o responsável por esta cotação.' }
  }

  // Idempotency: if already published, return success
  if (cotacao.status === 'aberta' || cotacao.status === 'em_andamento') {
    return {
      success: true,
      cotacaoId: cotacao.id,
      status: cotacao.status,
      message: 'Cotação já está publicada.',
    }
  }

  // Cannot publish if encerrada
  if (cotacao.status === 'encerrada') {
    return { success: false, error: 'Cotação já foi encerrada e não pode ser publicada novamente.' }
  }

  // Validate it's a draft
  if (cotacao.status !== 'rascunho') {
    return { success: false, error: `Cotação está com status "${cotacao.status}" e não pode ser publicada.` }
  }

  // Validate has items
  const itensCount = (cotacao.cotacao_itens as { id: string }[])?.length ?? 0
  if (itensCount === 0) {
    return { success: false, error: 'A cotação precisa ter pelo menos 1 item para ser publicada.' }
  }

  // Update status to 'aberta'
  const { error: updateError } = await supabase
    .from('cotacoes')
    .update({ status: 'aberta' })
    .eq('id', cotacaoId)
    .eq('status', 'rascunho') // Optimistic lock — prevents race conditions

  if (updateError) {
    console.error('[publicarCotacao] Update failed:', updateError.message)
    return { success: false, error: `Erro ao publicar: ${updateError.message}` }
  }

  // Revalidate all relevant paths
  revalidatePath('/empresario/cotacoes')
  revalidatePath(`/empresario/cotacoes/${cotacaoId}`)
  revalidatePath('/empresario/lista-cotacao')
  revalidatePath('/empresario/dashboard')
  revalidatePath('/fornecedor/cotacoes')
  revalidatePath('/fornecedor/dashboard')

  return {
    success: true,
    cotacaoId,
    status: 'aberta',
    message: 'Cotação publicada com sucesso! Fornecedores já podem enviar propostas.',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create + publish in one step — shared by every "send to suppliers" entry
// point (DraftListClient, nova/page.tsx, useOfflineSync) to avoid divergent
// copies of the same two-call sequence.
// ─────────────────────────────────────────────────────────────────────────────

type CreateAndPublishResult =
  | { success: true; id: string; status: 'aberta' }
  | { success: false; error: string }

/**
 * Creates a quotation as 'rascunho' and immediately publishes it.
 * If publishing fails after creation, the orphan draft is deleted so no
 * dangling 'rascunho' row is left behind silently.
 */
export async function criarEPublicarCotacao(formData: FormData): Promise<CreateAndPublishResult> {
  const created = await criarCotacao(formData, false)

  if ('error' in created) {
    return { success: false, error: created.error }
  }

  const published = await publicarCotacao(created.id)

  if (!published.success) {
    const { error: deleteError } = await deleteOrphanCotacao(created.id)
    if (deleteError) {
      console.error(
        '[criarEPublicarCotacao] Failed to clean up orphan draft %s after publish failure:',
        created.id,
        deleteError.message
      )
    }
    return { success: false, error: published.error }
  }

  return { success: true, id: created.id, status: 'aberta' }
}

async function deleteOrphanCotacao(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('cotacoes').delete().eq('id', id)
  return { error }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update quotation status
// ─────────────────────────────────────────────────────────────────────────────

export async function atualizarStatusCotacao(id: string, status: 'aberta' | 'em_andamento' | 'encerrada') {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RBAC: only the cotação owner may change its status.
  // Additionally, only owner/admin roles may close (encerrar) a cotação.
  try {
    await assertCotacaoOwnership(id)
    if (status === 'encerrada') {
      await assertCanFinalizarCotacao()
    }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const { error } = await supabase
    .from('cotacoes')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/empresario/cotacoes/${id}`)
  revalidatePath('/empresario/cotacoes')
  revalidatePath('/fornecedor/cotacoes')
  revalidatePath('/fornecedor/dashboard')
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete quotation
// ─────────────────────────────────────────────────────────────────────────────

export async function deletarCotacao(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RBAC: only the cotação owner may delete it.
  try {
    await assertCotacaoOwnership(id)
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const { error } = await supabase.from('cotacoes').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/empresario/cotacoes')
  redirect('/empresario/cotacoes')
}
