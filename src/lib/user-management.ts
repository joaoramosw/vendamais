/**
 * @deprecated This module is dead code. All user-management logic has been
 * replaced by the new auth/permissions system. Kept as a stub to avoid build errors.
 */

export type ManagedInvitationRole = 'admin' | 'member' | 'vendedor'

export function getManagedUserTipoFromOrganization(): string {
  return 'supplier'
}

export function deriveProfileRoleFromInvitation(): string | null {
  return null
}

export function getInvitationRolesForOrganization(): ManagedInvitationRole[] {
  return []
}

export type ManagedOrganizationOption = {
  id: string
  name: string
  tipo: string
}
