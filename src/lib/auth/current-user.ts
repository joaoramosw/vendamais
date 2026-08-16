'use server'

/**
 * auth/current-user.ts — Resolves the authenticated user from the `users` table.
 *
 * Replaces the old ensure-profile / roles.server pattern with a single
 * canonical lookup. Uses the `users` + `roles` tables instead of `profiles`.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { RoleKey } from '@/lib/types/database'

export type CurrentUser = {
  id: string
  /** Pode ser o e-mail sintético da conta criada por telefone — nunca mostre
   * direto na UI; use `emailExibivel`/`identificadorExibivel` (src/lib/phone.ts). */
  email: string
  /** Telefone normalizado (`5571999999999`) — é o identificador de login e o
   * que casa a conta com os convites de cotação. `users.whatsapp`. */
  telefone: string | null
  nome: string
  username: string | null
  role: RoleKey
  roleId: string
  organizationName: string | null
  activeOrganizationId: string | null
  mustChangePassword: boolean
}

/**
 * Returns the current authenticated user, or redirects to /login.
 * Fetches from `users` joined with `roles` in a single query.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: row, error } = await supabase
    .from('users')
    .select('id, nome, email, username, whatsapp, role_id, organization_name, active_organization_id, must_change_password, roles(key)')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !row) {
    console.warn('[getCurrentUser] User row not found for %s, returning minimal user', user.id)
    return {
      id: user.id,
      email: user.email ?? '',
      telefone: null,
      nome: user.user_metadata?.nome ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Usuario',
      username: null,
      role: 'supplier',
      roleId: '',
      organizationName: null,
      activeOrganizationId: null,
      mustChangePassword: false,
    }
  }

  const roleKey = (row as unknown as { roles: { key: string } | null }).roles?.key ?? 'supplier'

  return {
    id: row.id,
    email: row.email,
    telefone: row.whatsapp ?? null,
    nome: row.nome,
    username: row.username,
    role: roleKey as RoleKey,
    roleId: row.role_id,
    organizationName: row.organization_name,
    activeOrganizationId: row.active_organization_id,
    mustChangePassword: row.must_change_password,
  }
})

/**
 * Same as getCurrentUser() but returns null instead of redirecting.
 * Useful in middleware or contexts where redirect is not appropriate.
 */
export const getCurrentUserOrNull = cache(async function getCurrentUserOrNull(): Promise<CurrentUser | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: row } = await supabase
    .from('users')
    .select('id, nome, email, username, whatsapp, role_id, organization_name, active_organization_id, must_change_password, roles(key)')
    .eq('id', user.id)
    .maybeSingle()

  if (!row) return null

  const roleKey = (row as unknown as { roles: { key: string } | null }).roles?.key ?? 'supplier'

  return {
    id: row.id,
    email: row.email,
    telefone: row.whatsapp ?? null,
    nome: row.nome,
    username: row.username,
    role: roleKey as RoleKey,
    roleId: row.role_id,
    organizationName: row.organization_name,
    activeOrganizationId: row.active_organization_id,
    mustChangePassword: row.must_change_password,
  }
})
