'use server'

/**
 * authorization.ts — Server-side authorization guards.
 *
 * Uses the new RoleKey system (admin | supplier) instead of MembershipRole.
 * Guards throw Error on denial — catch in server actions and return { error }.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentUser, type CurrentUser } from '@/lib/auth/current-user'
import {
  canViewAllPropostas,
  canEditPropostaPrice,
  canFinalizarCotacao,
} from '@/lib/roles'

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper
// ─────────────────────────────────────────────────────────────────────────────

async function requireUser(): Promise<{ userId: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return { userId: user.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard 1 — View scope
// ─────────────────────────────────────────────────────────────────────────────

export async function assertCanViewAllPropostas(): Promise<void> {
  const user = await getCurrentUser()

  if (!canViewAllPropostas(user.role)) {
    throw new Error(
      'Acesso negado: Fornecedores só podem visualizar as propostas que enviaram.'
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard 2 — Price editing
// ─────────────────────────────────────────────────────────────────────────────

export async function assertCanEditPrice(
  cotacaoStatus: 'rascunho' | 'aberta' | 'em_andamento' | 'encerrada'
): Promise<void> {
  const user = await getCurrentUser()

  if (!canEditPropostaPrice(user.role, cotacaoStatus)) {
    const reason =
      cotacaoStatus !== 'aberta'
        ? 'Edição de preços não permitida: a cotação não está mais aberta.'
        : 'Sem permissão para editar preços nesta cotação.'

    throw new Error(reason)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard 3 — Finalize a cotação
// ─────────────────────────────────────────────────────────────────────────────

export async function assertCanFinalizarCotacao(): Promise<void> {
  const user = await getCurrentUser()

  if (!canFinalizarCotacao(user.role)) {
    throw new Error(
      'Sem permissão para encerrar cotações. Apenas administradores podem fazê-lo.'
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard 4 — Cotação ownership
// ─────────────────────────────────────────────────────────────────────────────

export async function assertCotacaoOwnership(cotacaoId: string): Promise<void> {
  const { userId } = await requireUser()
  const supabase = await createClient()

  const { data: cotacao, error } = await supabase
    .from('cotacoes')
    .select('admin_id')
    .eq('id', cotacaoId)
    .single()

  if (error || !cotacao) {
    throw new Error('Cotação não encontrada.')
  }

  if (cotacao.admin_id !== userId) {
    throw new Error(
      'Acesso negado: você não é o responsável por esta cotação.'
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard 5 — Proposta ownership (for accept/reject)
// ─────────────────────────────────────────────────────────────────────────────

export async function assertPropostaCotacaoOwnership(propostaId: string): Promise<void> {
  const { userId } = await requireUser()
  const supabase = await createClient()

  const { data: proposta, error } = await supabase
    .from('propostas')
    .select('cotacoes:cotacao_id ( admin_id )')
    .eq('id', propostaId)
    .single()

  if (error || !proposta) {
    throw new Error('Proposta não encontrada.')
  }

  const cotacao = (proposta.cotacoes as unknown) as { admin_id: string } | null

  if (!cotacao || cotacao.admin_id !== userId) {
    throw new Error(
      'Acesso negado: apenas o administrador responsável pela cotação pode gerir propostas.'
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility — Cotação visibility filter
// ─────────────────────────────────────────────────────────────────────────────

export async function getCotacaoVisibilityScope(): Promise<{
  restricted: boolean
  userId: string
}> {
  const { userId } = await requireUser()
  const user = await getCurrentUser()

  return {
    restricted: user.role === 'supplier',
    userId,
  }
}
