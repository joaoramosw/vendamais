'use server'

import { requireAdminWithClient, writeAuditLog } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export async function startUserImpersonation(
  targetUserId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()

    if (!/^[0-9a-fA-F-]{36}$/.test(targetUserId)) {
      return { success: false, error: 'Usuario invalido.' }
    }

    const { data: targetUser, error } = await adminClient
      .from('users')
      .select('id, nome, email, active_organization_id')
      .eq('id', targetUserId)
      .maybeSingle()

    if (error || !targetUser) {
      return { success: false, error: 'Usuario nao encontrado.' }
    }

    if (!targetUser.active_organization_id) {
      return { success: false, error: 'O usuario nao possui organizacao ativa para assumir.' }
    }

    const cookieStore = await cookies()

    cookieStore.set('acting_as_org_id', targetUser.active_organization_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60,
      path: '/',
    })

    cookieStore.set('acting_as_user_id', targetUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60,
      path: '/',
    })

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'impersonate_start',
      resourceType: 'user',
      resourceId: targetUser.id,
      metadata: {
        target_email: targetUser.email,
        target_name: targetUser.nome,
        acting_as_org_id: targetUser.active_organization_id,
      },
    })

    return { success: true, error: null }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel iniciar a impersonacao.',
    }
  }
}

export async function stopUserImpersonation(): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const cookieStore = await cookies()

    const actingAsOrgId = cookieStore.get('acting_as_org_id')?.value ?? null
    const actingAsUserId = cookieStore.get('acting_as_user_id')?.value ?? null

    cookieStore.delete('acting_as_org_id')
    cookieStore.delete('acting_as_user_id')

    if (actingAsOrgId || actingAsUserId) {
      await writeAuditLog({
        actorUserId: actor.id,
        action: 'impersonate_end',
        resourceType: actingAsUserId ? 'user' : 'organization',
        resourceId: actingAsUserId,
        metadata: actingAsOrgId ? { acting_as_org_id: actingAsOrgId } : undefined,
      })
    }

    revalidatePath('/', 'layout')
    return { success: true, error: null }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel encerrar a impersonacao.',
    }
  }
}
