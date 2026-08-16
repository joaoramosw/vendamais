import type { GlobalRole } from '@/lib/types/database'

const DEFAULT_SUPER_ADMIN_EMAILS = ['devjoaoramos@gmail.com']

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const normalized = email.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export function getUserManagementSuperAdminEmails(): string[] {
  const configured = process.env.USER_MANAGEMENT_SUPER_ADMIN_EMAILS
    ?.split(',')
    .map((item) => normalizeEmail(item))
    .filter((item): item is string => Boolean(item))

  if (configured && configured.length > 0) {
    return [...new Set(configured)]
  }

  return DEFAULT_SUPER_ADMIN_EMAILS
}

export function isProtectedUserManagementEmail(
  email: string | null | undefined
): boolean {
  const normalized = normalizeEmail(email)
  if (!normalized) return false

  return getUserManagementSuperAdminEmails().includes(normalized)
}

export function canAccessUserManagement(params: {
  email: string | null | undefined
  globalRole: GlobalRole | null | undefined
}): boolean {
  return (
    params.globalRole === 'admin' &&
    isProtectedUserManagementEmail(params.email)
  )
}
