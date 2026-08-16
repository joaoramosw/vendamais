'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { assertPropostaCotacaoOwnership } from '@/lib/authorization'
import { registrarAlteracaoPreco } from './cotacao-log'

// ─────────────────────────────────────────────────────────────────────────────
// Read actions
// ─────────────────────────────────────────────────────────────────────────────

export async function getMinhasPropostas() {
  const supabase = await createClient()

  // RBAC: always scope to the authenticated user's own proposals.
  // This is an explicit application-level guard (defense-in-depth over RLS).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('propostas')
    .select(`
      *,
      cotacoes:cotacao_id (
        titulo,
        status,
        profiles:empresario_id (nome, empresa)
      )
    `)
    .eq('fornecedor_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function getProposta(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('propostas')
    .select(`
      *,
      profiles:fornecedor_id (nome, empresa),
      cotacoes:cotacao_id (titulo, status),
      proposta_itens (
        *,
        cotacao_itens:cotacao_item_id (nome_produto, unidade, quantidade)
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// Write actions
// ─────────────────────────────────────────────────────────────────────────────

export async function enviarProposta(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Explicit domain guard — also enforced by RLS, but we fail fast here with
  // a clear message rather than letting the DB return a cryptic policy error.
  const { data: profile } = await supabase
    .from('profiles')
    .select('tipo')
    .eq('id', user.id)
    .single()

  if (profile?.tipo !== 'fornecedor') {
    console.error(
      '[enviarProposta] Access denied: user %s has tipo="%s", expected "fornecedor"',
      user.id,
      profile?.tipo ?? 'undefined'
    )
    return { error: 'Apenas fornecedores podem enviar propostas.' }
  }

  const cotacaoId = formData.get('cotacao_id') as string
  const observacao = formData.get('observacao') as string

  if (!cotacaoId) {
    return { error: 'Cotação inválida.' }
  }

  // Validate cotação status — only accept proposals for open quotations
  const { data: cotacao, error: cotacaoError } = await supabase
    .from('cotacoes')
    .select('id, status')
    .eq('id', cotacaoId)
    .single()

  if (cotacaoError || !cotacao) {
    return { error: 'Cotação não encontrada.' }
  }

  if (cotacao.status !== 'aberta' && cotacao.status !== 'em_andamento') {
    return { error: 'Esta cotação não está aceitando propostas no momento.' }
  }

  // Parse itens from FormData
  const itensJson = formData.get('itens') as string
  let itens: {
    cotacao_item_id: string
    preco_unitario: number
    quantidade_disponivel?: number | null
    observacao?: string
  }[] = []

  try {
    itens = JSON.parse(itensJson || '[]')
  } catch {
    return { error: 'Formato de itens inválido.' }
  }

  if (itens.length === 0) {
    return { error: 'Preencha o preço de pelo menos um item.' }
  }

  // Deduplicate by cotacao_item_id — a repeated item would double-insert into
  // proposta_itens and inflate valor_total. Keep the last occurrence.
  const dedupedItensMap = new Map(itens.map((item) => [item.cotacao_item_id, item]))
  itens = Array.from(dedupedItensMap.values())

  // Fetch the requested quantities from cotacao_itens to calculate total correctly.
  // We use the cotação's `quantidade` (what the buyer requested), NOT the supplier's
  // `quantidade_disponivel`, for a fair apples-to-apples comparison between suppliers.
  const cotacaoItemIds = itens.map((i) => i.cotacao_item_id)
  const { data: cotacaoItens } = await supabase
    .from('cotacao_itens')
    .select('id, quantidade')
    .in('id', cotacaoItemIds)

  const quantidadeMap: Record<string, number> = {}
  if (cotacaoItens) {
    for (const ci of cotacaoItens) {
      quantidadeMap[ci.id] = Number(ci.quantidade) || 0
    }
  }

  // Calculate total using cotação's requested quantity × supplier's unit price
  const valorTotal = itens.reduce((sum, item) => {
    const quantidadeSolicitada = quantidadeMap[item.cotacao_item_id] ?? 0
    return sum + item.preco_unitario * quantidadeSolicitada
  }, 0)

  // Insert proposta
  const { data: proposta, error: propostaError } = await supabase
    .from('propostas')
    .insert({
      cotacao_id: cotacaoId,
      fornecedor_id: user.id,
      observacao: observacao || null,
      valor_total: valorTotal,
    })
    .select('id')
    .single()

  if (propostaError) {
    console.error(
      '[enviarProposta] Insert failed: code=%s message=%s user=%s cotacao=%s',
      propostaError.code,
      propostaError.message,
      user.id,
      cotacaoId
    )
    if (propostaError.code === '23505') {
      return { error: 'Você já enviou uma proposta para esta cotação.' }
    }
    return { error: propostaError.message }
  }

  // Insert proposta itens
  const { error: itensError } = await supabase.from('proposta_itens').insert(
    itens.map((item) => ({
      proposta_id: proposta.id,
      cotacao_item_id: item.cotacao_item_id,
      preco_unitario: item.preco_unitario,
      quantidade_disponivel: item.quantidade_disponivel ?? null,
      observacao: item.observacao || null,
    }))
  )

  if (itensError) {
    console.error(
      '[enviarProposta] Itens insert failed: message=%s proposta=%s',
      itensError.message,
      proposta.id
    )
    // Roll back the orphan proposta — otherwise the UNIQUE(cotacao_id, fornecedor_id)
    // constraint would permanently block this supplier from ever retrying.
    const { error: rollbackError } = await supabase.from('propostas').delete().eq('id', proposta.id)
    if (rollbackError) {
      console.error(
        '[enviarProposta] Failed to roll back orphan proposta %s:',
        proposta.id,
        rollbackError.message
      )
    }
    return { error: itensError.message }
  }

  // Refetch inserted item IDs to register price-change history
  const { data: insertedItens } = await supabase
    .from('proposta_itens')
    .select('id, preco_unitario')
    .eq('proposta_id', proposta.id)

  if (insertedItens) {
    await Promise.all(
      insertedItens.map((i) => registrarAlteracaoPreco(i.id, 0, i.preco_unitario, user.id))
    )
  }

  revalidatePath('/fornecedor/propostas')
  revalidatePath(`/fornecedor/cotacoes/${cotacaoId}`)
  revalidatePath(`/empresario/cotacoes/${cotacaoId}`)
  revalidatePath('/empresario/cotacoes')
}

// ─────────────────────────────────────────────────────────────────────────────
// Manage proposal status (accept/reject)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manages a proposal's status. When accepting a proposal:
 * 1. Sets the proposal status to 'aceita'
 * 2. Rejects all other proposals for the same quotation
 * 3. Closes the quotation (status → 'encerrada')
 *
 * This ensures the full lifecycle is completed in a single action.
 */
export async function gerenciarProposta(
  propostaId: string,
  status: 'recebida' | 'aceita' | 'recusada'
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RBAC: only the empresário who owns the parent cotação may accept/reject.
  try {
    await assertPropostaCotacaoOwnership(propostaId)
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  // Fetch the proposal to get its cotacao_id and validate current status
  const { data: proposta, error: fetchError } = await supabase
    .from('propostas')
    .select('id, cotacao_id, status')
    .eq('id', propostaId)
    .single()

  if (fetchError || !proposta) {
    return { error: 'Proposta não encontrada.' }
  }

  // Prevent accepting/rejecting already-finalized proposals
  if (proposta.status === 'aceita' || proposta.status === 'recusada') {
    return { error: `Esta proposta já foi ${proposta.status}. Não é possível alterar.` }
  }

  if (status === 'aceita') {
    // Optimistic lock: atomically claim the cotação by flipping it to
    // 'encerrada' only if it isn't already. Postgres takes a row lock on this
    // UPDATE, so if two "aceitar" requests race for different proposals of the
    // same cotação, only one can win this claim — the loser gets 0 rows back
    // and is rejected here, before ever marking its proposal as 'aceita'.
    // This prevents two proposals from both ending up 'aceita' for one cotação.
    const { data: claimedCotacao, error: claimError } = await supabase
      .from('cotacoes')
      .update({ status: 'encerrada' })
      .eq('id', proposta.cotacao_id)
      .neq('status', 'encerrada')
      .select('id')

    if (claimError) return { error: claimError.message }

    if (!claimedCotacao || claimedCotacao.length === 0) {
      return {
        error: 'Esta cotação já foi encerrada — outra proposta pode já ter sido aceita. Atualize a página.',
      }
    }

    // Update the target proposal
    const { error: updateError } = await supabase
      .from('propostas')
      .update({ status })
      .eq('id', propostaId)

    if (updateError) return { error: updateError.message }

    // Reject all other proposals for the same cotação
    const { error: rejectError } = await supabase
      .from('propostas')
      .update({ status: 'recusada' })
      .eq('cotacao_id', proposta.cotacao_id)
      .neq('id', propostaId)
      .in('status', ['enviada', 'recebida']) // Only reject active ones

    if (rejectError) {
      console.error('[gerenciarProposta] Failed to reject other proposals:', rejectError.message)
      // Don't fail the whole operation — the acceptance went through
    }

    // Revalidate fornecedor paths so cotação disappears from their open list
    revalidatePath('/fornecedor/cotacoes')
    revalidatePath('/fornecedor/propostas')
    revalidatePath('/fornecedor/dashboard')
  } else {
    // Simple status update (recusada/recebida) — no cotação-level lock needed
    // since it doesn't touch the cotação's status.
    const { error: updateError } = await supabase
      .from('propostas')
      .update({ status })
      .eq('id', propostaId)

    if (updateError) return { error: updateError.message }
  }

  // Revalidate empresário paths
  revalidatePath(`/empresario/cotacoes/${proposta.cotacao_id}`)
  revalidatePath('/empresario/cotacoes')
  revalidatePath('/empresario/dashboard')
}
