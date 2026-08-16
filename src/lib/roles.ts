/**
 * roles.ts — Pure role/permission functions (no I/O).
 *
 * Uses the new RoleKey system (admin | supplier) instead of the old
 * UserRole (admin | moderador | fornecedor) / MembershipRole system.
 */

import type { RoleKey } from '@/lib/types/database'
import { hasPermission, canManageQuotes, canRespondQuotes } from '@/lib/auth/permissions'

// ── Cotação / Proposta permissions (pure) ───────────────────────────────────

/**
 * Generic permission check — maps action strings to role-based decisions.
 * Used by product CRUD components.
 */
export function checkPermission(
  role: RoleKey | null,
  permission: string
): boolean {
  if (!role) return false
  if (role === 'admin') return true
  // supplier has no create/update/delete/batch_edit permissions on products
  return false
}

/**
 * Admin can see ALL proposals. Supplier sees only their own.
 */
export function canViewAllPropostas(role: RoleKey | null): boolean {
  return role === 'admin'
}

/**
 * Only suppliers can edit prices, and only while cotação is 'aberta'.
 */
export function canEditPropostaPrice(
  role: RoleKey | null,
  cotacaoStatus: 'rascunho' | 'aberta' | 'em_andamento' | 'encerrada'
): boolean {
  return role === 'supplier' && cotacaoStatus === 'aberta'
}

/**
 * Only admins can finalize/close a cotação.
 */
export function canFinalizarCotacao(role: RoleKey | null): boolean {
  return role === 'admin'
}

/**
 * Suppliers are restricted to viewing only their own submissions.
 */
export function isSupplierRestricted(role: RoleKey | null): boolean {
  return role === 'supplier'
}

// ── Backward compatibility aliases (deprecated) ─────────────────────────────

/** @deprecated Use canManageQuotes(role) instead */
export function canAccessProducts(role: RoleKey): boolean {
  return canManageQuotes(role)
}

/** @deprecated Use canViewAllPropostas(role) instead */
export function canViewAllPropostasLegacy(role: RoleKey | null): boolean {
  if (!role) return false
  return canViewAllPropostas(role)
}

/** @deprecated Use canFinalizarCotacao(role) instead */
export function canFinalizarCotacaoLegacy(role: RoleKey | null): boolean {
  if (!role) return false
  return canFinalizarCotacao(role)
}

/** @deprecated Use isSupplierRestricted(role) instead */
export function isVendedorRestricted(role: RoleKey | null): boolean {
  if (!role) return false
  return isSupplierRestricted(role)
}
