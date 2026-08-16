/**
 * auth/permissions.ts — Pure permission functions (no I/O, fully testable).
 *
 * This is the single source of truth for what each role can do.
 * When adding a new permission or role, update ROLE_PERMISSIONS below.
 */

import type { RoleKey, PermissionKey } from '@/lib/types/database'

// ── Static permission map ───────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  admin: [
    'users.read',
    'users.create',
    'users.update',
    'users.disable',
    'quotes.manage',
    'products.manage',
    'categories.manage',
    'dashboard.read',
  ],
  supplier: [
    'quotes.respond',
    'dashboard.read',
  ],
} as const

// ── Pure helpers ────────────────────────────────────────────────────────────

export function hasPermission(role: RoleKey, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: RoleKey, permissions: PermissionKey[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

export function getRolePermissions(role: RoleKey): readonly PermissionKey[] {
  return ROLE_PERMISSIONS[role] ?? []
}

// ── Domain-specific helpers (compose hasPermission for readability) ──────────

export function canAccessUsers(role: RoleKey): boolean {
  return hasPermission(role, 'users.read')
}

export function canCreateUsers(role: RoleKey): boolean {
  return hasPermission(role, 'users.create')
}

export function canUpdateUsers(role: RoleKey): boolean {
  return hasPermission(role, 'users.update')
}

export function canDisableUsers(role: RoleKey): boolean {
  return hasPermission(role, 'users.disable')
}

export function canManageQuotes(role: RoleKey): boolean {
  return hasPermission(role, 'quotes.manage')
}

export function canRespondQuotes(role: RoleKey): boolean {
  return hasPermission(role, 'quotes.respond')
}

export function canManageProducts(role: RoleKey): boolean {
  return hasPermission(role, 'products.manage')
}

export function canManageCategories(role: RoleKey): boolean {
  return hasPermission(role, 'categories.manage')
}

export function canReadDashboard(role: RoleKey): boolean {
  return hasPermission(role, 'dashboard.read')
}

// ── Role display labels ─────────────────────────────────────────────────────

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin: 'Administrador',
  supplier: 'Fornecedor',
}

export function getRoleLabel(role: RoleKey): string {
  return ROLE_LABELS[role] ?? role
}
