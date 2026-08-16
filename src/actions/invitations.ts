'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdminWithClient, writeAuditLog } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────
// Buscar convite por token (pagina publica /convite/[token])
// ─────────────────────────────────────────────────────────

export type InvitationPublic = {
  id: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
}

export async function getInvitationByToken(token: string): Promise<{
  invitation: InvitationPublic | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invitations')
    .select(`
      id,
      email,
      role,
      expires_at,
      accepted_at
    `)
    .eq('token', token)
    .single()

  if (error || !data) return { invitation: null, error: 'Convite nao encontrado ou invalido.' }

  const isExpired = new Date(data.expires_at) < new Date()
  if (isExpired) return { invitation: null, error: 'Este convite expirou.' }

  if (data.accepted_at) return { invitation: null, error: 'Este convite ja foi utilizado.' }

  return { invitation: data as InvitationPublic, error: null }
}

// ─────────────────────────────────────────────────────────
// Reset de senha — admin only
// ─────────────────────────────────────────────────────────

export async function sendPasswordReset(
  targetEmail: string
): Promise<{ success: boolean; error: string | null; actionLink: string | null }> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const email = targetEmail?.trim().toLowerCase()

    if (!email || !email.includes('@')) {
      return { success: false, error: 'E-mail invalido.', actionLink: null }
    }

    // Find target user
    const { data: targetUser } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!targetUser) {
      return { success: false, error: 'Usuario nao encontrado.', actionLink: null }
    }

    // Generate recovery link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (linkError || !linkData) {
      return { success: false, error: linkError?.message ?? 'Erro ao gerar link.', actionLink: null }
    }

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'password_reset_sent',
      resourceType: 'user',
      resourceId: targetUser.id,
      metadata: { target_email: email },
    })

    return {
      success: true,
      error: null,
      actionLink: linkData.properties?.action_link ?? null,
    }
  } catch (error) {
    return { success: false, error: toErrorMessage(error), actionLink: null }
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Dados invalidos.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Ocorreu um erro inesperado.'
}
