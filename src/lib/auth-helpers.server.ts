'use server'

/**
 * auth-helpers.server.ts
 *
 * Single Responsibility: resolve the authenticated user's role
 * and enforce domain-level access guards.
 *
 * Uses the new `users` + `roles` tables instead of `profiles`.
 */

import { getCurrentUser, type CurrentUser } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'
import type { RoleKey } from '@/lib/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

const DASHBOARD_BY_ROLE: Record<RoleKey, string> = {
  admin: '/empresario/dashboard',
  supplier: '/fornecedor/dashboard',
}

export interface ResolvedProfile {
  userId: string
  role: RoleKey
}

/**
 * Resolves the current user's authenticated profile.
 *
 * - Redirects to `/login` if the user is not authenticated.
 * - Returns `{ userId, role }` where `role` is always a valid RoleKey.
 */
export async function resolveCurrentProfile(): Promise<ResolvedProfile> {
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  return { userId: user.id, role: user.role }
}

/**
 * Like `resolveCurrentProfile`, but additionally enforces that the user
 * belongs to the expected domain (`expectedRole`).
 *
 * If the user's role does not match, they are redirected to their own
 * dashboard instead of seeing an error page.
 */
export async function requireUserRole(expectedRole: RoleKey): Promise<ResolvedProfile> {
  const resolved = await resolveCurrentProfile()

  if (resolved.role !== expectedRole) {
    redirect(DASHBOARD_BY_ROLE[resolved.role])
  }

  return resolved
}
