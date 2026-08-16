import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { GlobalRole } from '@/lib/types/database'
import { canAccessUserManagement, normalizeEmail } from '@/lib/user-management-security'
import { redirect } from 'next/navigation'

export type UserManagementActor = {
  userId: string
  email: string
  name: string | null
  globalRole: GlobalRole
}

export async function requireUserManagementSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('email, nome, global_role')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new Error('Nao foi possivel validar o acesso do usuario atual.')
  }

  const email = normalizeEmail(user.email ?? profile.email)

  if (!canAccessUserManagement({ email, globalRole: profile.global_role })) {
    throw new Error('Acesso negado. A gestao de usuarios e exclusiva do super admin autorizado.')
  }

  return {
    supabase,
    adminClient: createAdminClient(),
    actor: {
      userId: user.id,
      email: email ?? '',
      name: profile.nome ?? null,
      globalRole: profile.global_role as GlobalRole,
    } satisfies UserManagementActor,
  }
}

export async function writeUserManagementAuditLog(data: {
  actorUserId: string
  action: string
  resourceType?: string | null
  resourceId?: string | null
  actingAsOrgId?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const adminClient = createAdminClient()

  await adminClient.from('audit_log').insert({
    actor_user_id: data.actorUserId,
    acting_as_org_id: data.actingAsOrgId ?? null,
    action: data.action,
    resource_type: data.resourceType ?? null,
    resource_id: data.resourceId ?? null,
    metadata: data.metadata ?? null,
  })
}
