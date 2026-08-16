import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { RoleKey } from '@/lib/types/database'

export interface BasicUser {
  id: string
  nome: string
  email: string
  role: RoleKey
  roleId: string
  organizationName: string | null
  activeOrganizationId: string | null
  mustChangePassword: boolean
}

function deriveRoleFromMeta(raw: unknown): RoleKey {
  if (typeof raw === 'string' && raw.toLowerCase().trim() === 'admin') {
    return 'admin'
  }
  return 'supplier'
}

export async function ensureUser(
  supabase: SupabaseClient,
  user: User
): Promise<BasicUser> {
  const meta = user.user_metadata || {}
  const metaRole = deriveRoleFromMeta(meta.role ?? meta.tipo)

  const { data: row } = await supabase
    .from('users')
    .select('id, nome, email, role_id, organization_name, active_organization_id, must_change_password, roles(key)')
    .eq('id', user.id)
    .maybeSingle()

  if (row) {
    const roleKey = (row as unknown as { roles: { key: string } | null }).roles?.key ?? metaRole
    return {
      id: row.id,
      nome: row.nome,
      email: row.email,
      role: roleKey as RoleKey,
      roleId: row.role_id,
      organizationName: row.organization_name,
      activeOrganizationId: row.active_organization_id,
      mustChangePassword: row.must_change_password,
    }
  }

  // Row doesn't exist yet — create it
  console.log('[ensureUser] Creating missing user row for:', user.id)

  // Resolve role_id
  const { data: roleRow } = await supabase
    .from('roles')
    .select('id')
    .eq('key', metaRole)
    .maybeSingle()

  const roleId = roleRow?.id

  if (!roleId) {
    console.warn('[ensureUser] Role "%s" not found in roles table', metaRole)
    return {
      id: user.id,
      nome: meta.nome || meta.name || user.email?.split('@')[0] || 'Usuario',
      email: user.email || '',
      role: metaRole,
      roleId: '',
      organizationName: null,
      activeOrganizationId: null,
      mustChangePassword: false,
    }
  }

  const newUser = {
    id: user.id,
    nome: meta.nome || meta.name || user.email?.split('@')[0] || 'Usuario',
    email: user.email || '',
    role: metaRole,
    roleId: roleId,
    organizationName: null,
    activeOrganizationId: null,
    mustChangePassword: false,
  }

  const { error: insertError } = await supabase
    .from('users')
    .upsert(
      {
        id: newUser.id,
        nome: newUser.nome,
        email: newUser.email,
        role_id: roleId,
      },
      { onConflict: 'id' }
    )

  if (insertError) {
    console.warn('[ensureUser] Failed to create user row:', insertError.message)
  }

  return newUser
}

// Backward compatibility alias
export const ensureProfile = ensureUser
