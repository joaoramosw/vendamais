'use server'

/**
 * auth/guard.ts — Server-side authorization guards.
 *
 * Replaces the old user-management.server.ts / authorization.ts pattern.
 * Uses the `users` + `roles` + `permissions` tables instead of profiles/memberships.
 */

import { getCurrentUser, type CurrentUser } from '@/lib/auth/current-user'
import { hasPermission, type canAccessUsers as _canAccessUsers } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { RoleKey, PermissionKey } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Auth guard ──────────────────────────────────────────────────────────────

/**
 * Ensures the user is authenticated and returns their data.
 * Redirects to /login if not authenticated.
 */
export async function requireAuth(): Promise<CurrentUser> {
  return getCurrentUser()
}

// ── Permission guards ───────────────────────────────────────────────────────

/**
 * Ensures the current user has the specified permission.
 * Throws if denied (catch in server actions and return { error }).
 */
export async function requirePermission(permission: PermissionKey): Promise<CurrentUser> {
  const user = await getCurrentUser()

  if (!hasPermission(user.role, permission)) {
    throw new Error('Acesso negado. Você não tem permissão para esta ação.')
  }

  return user
}

/**
 * Ensures the current user has one of the specified permissions.
 */
export async function requireAnyPermission(...permissions: PermissionKey[]): Promise<CurrentUser> {
  const user = await getCurrentUser()

  if (!permissions.some((p) => hasPermission(user.role, p))) {
    throw new Error('Acesso negado. Você não tem permissão para esta ação.')
  }

  return user
}

/**
 * Ensures the current user has the specified role.
 * Throws if denied.
 */
export async function requireRole(role: RoleKey): Promise<CurrentUser> {
  const user = await getCurrentUser()

  if (user.role !== role) {
    throw new Error('Acesso negado. Esta ação é restrita a outro tipo de usuário.')
  }

  return user
}

/**
 * Ensures the current user is an admin.
 * Convenience wrapper over requireRole('admin').
 */
export async function requireAdmin(): Promise<CurrentUser> {
  return requireRole('admin')
}

// ── Composite guards for common patterns ────────────────────────────────────

/**
 * Returns the current user + admin client (service_role).
 * Used by actions that need to bypass RLS.
 */
export async function requireAdminWithClient(): Promise<{
  user: CurrentUser
  adminClient: ReturnType<typeof createAdminClient>
}> {
  const user = await requireAdmin()
  return { user, adminClient: createAdminClient() }
}

/**
 * Returns the current user + regular Supabase client.
 */
export async function requireAuthWithClient(): Promise<{
  user: CurrentUser
  supabase: SupabaseClient
}> {
  const user = await requireAuth()
  const supabase = await createClient()
  return { user, supabase }
}

// ── Audit log helper ────────────────────────────────────────────────────────

export async function writeAuditLog(data: {
  actorUserId: string
  action: string
  resourceType?: string | null
  resourceId?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const adminClient = createAdminClient()

  await adminClient.from('audit_log').insert({
    actor_user_id: data.actorUserId,
    action: data.action,
    resource_type: data.resourceType ?? null,
    resource_id: data.resourceId ?? null,
    metadata: data.metadata ?? null,
  })
}
