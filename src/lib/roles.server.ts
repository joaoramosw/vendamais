'use server'

/**
 * roles.server.ts — Server-side role resolvers.
 *
 * Uses the new `users` + `roles` tables instead of `profiles` / `memberships`.
 */

import { getCurrentUser, type CurrentUser } from '@/lib/auth/current-user'
import type { RoleKey } from '@/lib/types/database'

/**
 * Returns the current user's role key (admin | supplier).
 */
export async function getCurrentUserRole(): Promise<RoleKey> {
  const user = await getCurrentUser()
  return user.role
}

/**
 * Returns the full current user object.
 * Alias for getCurrentUser() — kept for backward compatibility.
 */
export async function getUserProfile(): Promise<CurrentUser> {
  return getCurrentUser()
}

// ── Backward compatibility aliases (deprecated) ─────────────────────────────

/** @deprecated Use getCurrentUserRole() instead */
export async function getUserTipo(): Promise<RoleKey> {
  return getCurrentUserRole()
}

/** @deprecated Use getCurrentUserRole() instead */
export async function getUserRole(): Promise<RoleKey> {
  return getCurrentUserRole()
}

/** @deprecated Use getCurrentUserRole() instead */
export async function getGlobalRole(): Promise<RoleKey> {
  return getCurrentUserRole()
}

/** @deprecated Use getCurrentUserRole() instead. The membership system is removed. */
export async function getUserMembershipRole(): Promise<RoleKey> {
  return getCurrentUserRole()
}
