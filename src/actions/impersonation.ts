'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// ─────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────

async function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireSuperAdminCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', user.id)
    .single()

  if (profile?.global_role !== 'super_admin') {
    throw new Error('Acesso negado.')
  }

  return { supabase, adminClient: await getAdminClient(), user }
}

async function writeAuditLog(data: {
  actor_user_id: string
  acting_as_org_id?: string | null
  action: string
  resource_type?: string
  resource_id?: string
  metadata?: Record<string, unknown>
}) {
  const adminClient = await getAdminClient()
  await adminClient.from('audit_log').insert({
    actor_user_id: data.actor_user_id,
    acting_as_org_id: data.acting_as_org_id ?? null,
    action: data.action,
    resource_type: data.resource_type ?? null,
    resource_id: data.resource_id ?? null,
    metadata: data.metadata ?? null,
  })
}

// ─────────────────────────────────────────────────────────
// Impersonação segura (super_admin apenas)
// ─────────────────────────────────────────────────────────

export async function startImpersonation(
  orgId: string
): Promise<{ success: boolean; error: string | null }> {
  const { user } = await requireSuperAdminCtx()

  const cookieStore = await cookies()

  // Cookie HttpOnly de curta duração: 1 hora
  cookieStore.set('acting_as_org_id', orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hora
    path: '/',
  })

  await writeAuditLog({
    actor_user_id: user.id,
    acting_as_org_id: orgId,
    action: 'impersonate_start',
    resource_type: 'organization',
    resource_id: orgId,
  })

  return { success: true, error: null }
}

export async function stopImpersonation(): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const actingAsOrgId = cookieStore.get('acting_as_org_id')?.value

  cookieStore.delete('acting_as_org_id')

  if (actingAsOrgId) {
    await writeAuditLog({
      actor_user_id: user.id,
      acting_as_org_id: actingAsOrgId,
      action: 'impersonate_end',
      resource_type: 'organization',
      resource_id: actingAsOrgId,
    })
  }

  revalidatePath('/', 'layout')
  return { success: true, error: null }
}

// ─────────────────────────────────────────────────────────
// Histórico de auditoria — leitura (super_admin)
// ─────────────────────────────────────────────────────────

export type AuditLogEntry = {
  id: number
  actor_user_id: string
  acting_as_org_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export async function getAuditLog(limit = 100): Promise<{
  entries: AuditLogEntry[]
  error: string | null
}> {
  const { supabase } = await requireSuperAdminCtx()

  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { entries: [], error: error.message }
  return { entries: (data as AuditLogEntry[]) ?? [], error: null }
}
