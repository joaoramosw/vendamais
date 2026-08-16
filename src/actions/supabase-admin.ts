'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserTipo, GlobalRole } from '@/lib/types/database'
import { redirect } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// Guards
// ─────────────────────────────────────────────────────────────────────────────

async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.global_role !== 'super_admin') {
    throw new Error('Acesso restrito a super administradores.')
  }

  return { userId: user.id }
}

async function requireEmpresarioOrSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tipo, global_role')
    .eq('id', user.id)
    .maybeSingle()

  const isSuperAdmin = profile?.global_role === 'super_admin'
  const isEmpresario = profile?.tipo === 'empresario'

  if (!isSuperAdmin && !isEmpresario) {
    throw new Error('Acesso negado.')
  }

  return { userId: user.id, isSuperAdmin }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: fix user profile (permanent action)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Permanently fixes a user's profile, synchronising auth metadata and
 * the profiles table. Use this to correct users who ended up with the
 * wrong tipo or global_role.
 *
 * Protected: only super_admin can call this.
 */
export async function adminFixUserProfile(data: {
  email: string
  tipo?: UserTipo
  global_role?: GlobalRole
}): Promise<{ success: boolean; userId: string | null; error: string | null; details?: string }> {
  await requireSuperAdmin()

  const email = data.email?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { success: false, userId: null, error: 'E-mail inválido.' }
  }

  const adminClient = createAdminClient()

  // 1. Find the user by email
  const { data: userList, error: listError } = await adminClient.auth.admin.listUsers()
  if (listError) return { success: false, userId: null, error: listError.message }

  const targetUser = userList.users.find(
    (u) => u.email?.toLowerCase() === email
  )
  if (!targetUser) {
    return { success: false, userId: null, error: `Usuário "${email}" não encontrado no auth.` }
  }

  const userId = targetUser.id
  const changes: string[] = []

  // 2. Update auth.users.user_metadata.tipo if requested
  if (data.tipo) {
    const currentMeta = targetUser.user_metadata || {}
    const { error: metaError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { ...currentMeta, tipo: data.tipo },
    })
    if (metaError) {
      return { success: false, userId, error: `Erro ao atualizar auth metadata: ${metaError.message}` }
    }
    changes.push(`auth.user_metadata.tipo → "${data.tipo}"`)
  }

  // 3. Update profiles table
  const profilePatch: Record<string, unknown> = {}
  if (data.tipo) profilePatch.tipo = data.tipo
  if (data.global_role) profilePatch.global_role = data.global_role

  if (Object.keys(profilePatch).length > 0) {
    const { error: profileError } = await adminClient
      .from('profiles')
      .update(profilePatch)
      .eq('id', userId)

    if (profileError) {
      return { success: false, userId, error: `Erro ao atualizar profile: ${profileError.message}` }
    }
    changes.push(
      ...Object.entries(profilePatch).map(([k, v]) => `profiles.${k} → "${v}"`)
    )
  }

  return {
    success: true,
    userId,
    error: null,
    details: changes.length > 0 ? changes.join(', ') : 'Nenhuma alteração necessária.',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: invite fornecedor
// ─────────────────────────────────────────────────────────────────────────────

export async function inviteFornecedorByEmail(data: {
  email: string
  nome?: string
  username?: string
  company_name?: string
}): Promise<{ success: boolean; userId: string | null; error: string | null }> {
  await requireEmpresarioOrSuperAdmin()

  const email = data.email?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { success: false, userId: null, error: 'E-mail inválido.' }
  }

  const adminClient = createAdminClient()

  const userMetadata: Record<string, unknown> = {
    tipo: 'fornecedor',
  }

  if (data.nome?.trim()) userMetadata.nome = data.nome.trim()
  if (data.username?.trim()) userMetadata.username = data.username.trim()
  if (data.company_name?.trim()) userMetadata.company_name = data.company_name.trim()

  const { data: invited, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: userMetadata,
  })

  if (error) return { success: false, userId: null, error: error.message }
  if (!invited.user) return { success: false, userId: null, error: 'Usuário não foi criado.' }

  return { success: true, userId: invited.user.id, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: update user metadata
// ─────────────────────────────────────────────────────────────────────────────

export async function adminUpdateUserMetadata(data: {
  userId: string
  user_metadata: Record<string, unknown>
}): Promise<{ success: boolean; error: string | null }> {
  const { userId: callerId, isSuperAdmin } = await requireEmpresarioOrSuperAdmin()

  if (!data.userId?.trim()) {
    return { success: false, error: 'userId inválido.' }
  }

  const targetUserId = data.userId.trim()
  if (!isSuperAdmin && callerId !== targetUserId) {
    return { success: false, error: 'Acesso negado.' }
  }

  const adminClient = createAdminClient()

  const { data: existing, error: existingError } = await adminClient.auth.admin.getUserById(
    targetUserId
  )
  if (existingError) return { success: false, error: existingError.message }

  const merged = {
    ...(existing.user?.user_metadata ?? {}),
    ...(data.user_metadata ?? {}),
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    user_metadata: merged,
  })

  if (updateError) return { success: false, error: updateError.message }

  // Best-effort sync with `profiles` table (UI reads these fields).
  const profilePatch: Record<string, unknown> = {}
  const username = (merged as { username?: unknown }).username
  const companyName =
    (merged as { company_name?: unknown }).company_name ?? (merged as { empresa?: unknown }).empresa
  const nome = (merged as { nome?: unknown }).nome

  if (typeof username === 'string') profilePatch.username = username
  if (typeof companyName === 'string') profilePatch.empresa = companyName
  if (typeof nome === 'string') profilePatch.nome = nome

  if (Object.keys(profilePatch).length > 0) {
    await adminClient.from('profiles').update(profilePatch).eq('id', targetUserId)
  }

  return { success: true, error: null }
}
