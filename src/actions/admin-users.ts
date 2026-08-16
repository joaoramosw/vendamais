'use server'

import type { RoleKey } from '@/lib/types/database'
import { requireAdminWithClient, writeAuditLog } from '@/lib/auth/guard'
import { isSyntheticEmail, isValidPhone, normalizePhone, phoneToSyntheticEmail } from '@/lib/phone'
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const USERS_PAGE_PATH = '/empresario/usuarios'

// ── Zod schemas ─────────────────────────────────────────────────────────────

/**
 * Telefone é o identificador de login (ver src/lib/phone.ts) — obrigatório em
 * toda conta criada ou editada por aqui. Sem ele a pessoa não consegue entrar,
 * já que nenhuma tela de auth pede e-mail.
 */
const telefoneField = z
  .string()
  .trim()
  .refine(isValidPhone, 'Informe um telefone valido com DDD (ex.: (71) 99999-9999).')
  .transform((v) => normalizePhone(v))

const createUserSchema = z.object({
  telefone: telefoneField,
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  username: z
    .string()
    .trim()
    .min(3, 'Informe um nome de usuario com ao menos 3 caracteres.')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Use apenas letras, numeros e underline.'),
  role: z.enum(['admin', 'supplier']),
  organizationName: z.string().max(120).optional(),
})

const updateUserRoleSchema = z.object({
  targetUserId: z.string().uuid('Usuario invalido.'),
  role: z.enum(['admin', 'supplier']),
})

const updateUserInfoSchema = z.object({
  targetUserId: z.string().uuid('Usuario invalido.'),
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  telefone: telefoneField,
  organizationName: z.string().max(120).optional(),
})

const updateUserSegmentoSchema = z.object({
  targetUserId: z.string().uuid('Usuario invalido.'),
  segmentoId: z.string().uuid('Segmento invalido.').nullable(),
})

const targetUserSchema = z.object({
  targetUserId: z.string().uuid('Usuario invalido.'),
})

const createInvitationSchema = z.object({
  email: z.email('Informe um e-mail valido.'),
  role: z.enum(['admin', 'supplier']),
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateTemporaryPassword(): string {
  const block = () => randomBytes(3).toString('hex')
  return `Vm-${block()}-${block()}`
}

function toErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Dados invalidos.'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Ocorreu um erro inesperado.'
}

// ── Types ───────────────────────────────────────────────────────────────────

export type AdminUserView = {
  id: string
  nome: string
  /** Pode ser o e-mail sintético da conta por telefone — não exiba direto. */
  email: string
  /** Telefone de login (`users.whatsapp`). É o identificador mostrado na tela. */
  telefone: string | null
  role: RoleKey
  username: string | null
  organization_name: string | null
  must_change_password: boolean
  created_at: string
  segmento_id: string | null
  segmento_nome: string | null
  segmento_cor: string | null
  banned: boolean
}

// ── List all users ──────────────────────────────────────────────────────────

export async function listAllUsers(): Promise<{
  users: AdminUserView[]
  error: string | null
}> {
  try {
    const { adminClient } = await requireAdminWithClient()

    const { data: users, error } = await adminClient
      .from('users')
      .select('id, nome, email, username, whatsapp, role_id, organization_name, must_change_password, created_at, roles(key), segmentos(id, nome, cor)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) return { users: [], error: error.message }

    // Status de ban só existe no Supabase Auth, não na tabela `users` — busca
    // uma vez e mescla por id. `perPage` alto porque é lista de admin (dezenas
    // de usuarios, nao milhares); sem paginacao proporcional ao tamanho real.
    const { data: authList } = await adminClient.auth.admin.listUsers({ perPage: 200 })
    const bannedById = new Map<string, boolean>(
      (authList?.users ?? []).map((u) => {
        const bannedUntil = u.banned_until
        return [u.id, !!bannedUntil && new Date(bannedUntil) > new Date()]
      })
    )

    const mapped = ((users as unknown as Array<
      { roles: { key: string } | null; segmentos: { id: string; nome: string; cor: string | null } | null } & Record<string, unknown>
    >) ?? []).map((row) => ({
      id: row.id as string,
      nome: row.nome as string,
      email: row.email as string,
      telefone: (row.whatsapp as string | null) ?? null,
      role: (row.roles?.key ?? 'supplier') as RoleKey,
      username: row.username as string | null,
      organization_name: row.organization_name as string | null,
      must_change_password: row.must_change_password as boolean,
      created_at: row.created_at as string,
      segmento_id: row.segmentos?.id ?? null,
      segmento_nome: row.segmentos?.nome ?? null,
      segmento_cor: row.segmentos?.cor ?? null,
      banned: bannedById.get(row.id as string) ?? false,
    }))

    return { users: mapped, error: null }
  } catch (error) {
    return { users: [], error: toErrorMessage(error) }
  }
}

// ── Update user role ────────────────────────────────────────────────────────

export async function updateUserRole(
  targetUserId: string,
  role: RoleKey
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const data = updateUserRoleSchema.parse({ targetUserId, role })

    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id, email, roles(key)')
      .eq('id', data.targetUserId)
      .maybeSingle()

    if (targetError || !target) {
      return { success: false, error: 'Usuario nao encontrado.' }
    }

    const { data: newRole } = await adminClient
      .from('roles')
      .select('id')
      .eq('key', data.role)
      .single()

    if (!newRole) {
      return { success: false, error: 'Role invalida.' }
    }

    const { error } = await adminClient
      .from('users')
      .update({ role_id: newRole.id })
      .eq('id', data.targetUserId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'user_role_updated',
      resourceType: 'user',
      resourceId: data.targetUserId,
      metadata: {
        target_email: (target as unknown as { email: string }).email,
        new_role: data.role,
      },
    })

    revalidatePath(USERS_PAGE_PATH)
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}

// ── Get user for edit ────────────────────────────────────────────────────────

export async function getUserForEdit(targetUserId: string): Promise<
  | {
      status: 'ok'
      user: {
        id: string
        nome: string
        email: string
        whatsapp: string | null
        organization_name: string | null
      }
    }
  | { status: 'not_found' }
  | { status: 'error'; error: string }
> {
  let parsed: { targetUserId: string }
  try {
    parsed = targetUserSchema.parse({ targetUserId })
  } catch {
    // ID mal formado (nao-UUID) e tratado como "nao encontrado", nao como erro tecnico.
    return { status: 'not_found' }
  }

  try {
    const { adminClient } = await requireAdminWithClient()

    const { data: user, error } = await adminClient
      .from('users')
      .select('id, nome, email, whatsapp, organization_name')
      .eq('id', parsed.targetUserId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      console.error('[getUserForEdit] Falha na consulta ao Supabase', {
        targetUserId: parsed.targetUserId,
        code: error.code,
        message: error.message,
      })
      return { status: 'error', error: error.message }
    }

    if (!user) return { status: 'not_found' }

    return { status: 'ok', user }
  } catch (error) {
    const message = toErrorMessage(error)
    console.error('[getUserForEdit] Erro inesperado', {
      targetUserId: parsed.targetUserId,
      message,
    })
    return { status: 'error', error: message }
  }
}

// ── Update user info (nome, telefone, empresa) ──────────────────────────────

/**
 * Atualiza os dados do usuário. O **telefone** é o identificador de login, e
 * mudá-lo tem duas consequências:
 *
 *  1. `users.whatsapp` passa a ser o novo número — é por ele que
 *     `signInWithPhone` acha a conta e que os convites de cotação casam com
 *     ela (`fornecedores_convidados.whatsapp`);
 *  2. se a conta usa e-mail sintético (foi criada por telefone), o e-mail do
 *     Auth acompanha o número novo. Conta legada com e-mail real **não** tem o
 *     e-mail mexido — o login continua funcionando porque a resolução é sempre
 *     `telefone → users.email → Auth`.
 */
export async function updateUserInfo(
  targetUserId: string,
  input: { nome: string; telefone: string; organizationName?: string | null }
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const data = updateUserInfoSchema.parse({ targetUserId, ...input })

    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id, email, whatsapp, organization_name')
      .eq('id', data.targetUserId)
      .maybeSingle()

    if (targetError || !target) {
      return { success: false, error: 'Usuario nao encontrado.' }
    }

    const alvo = target as { email: string; whatsapp: string | null; organization_name: string | null }
    const oldEmail = alvo.email
    const oldTelefone = alvo.whatsapp
    const telefoneChanged = data.telefone !== oldTelefone

    if (telefoneChanged) {
      const { data: existingPhone } = await adminClient
        .from('users')
        .select('id')
        .eq('whatsapp', data.telefone)
        .is('deleted_at', null)
        .neq('id', data.targetUserId)
        .maybeSingle()

      if (existingPhone) {
        return { success: false, error: 'Ja existe um usuario com este telefone.' }
      }
    }

    // Só conta com e-mail sintético tem o endereço reescrito junto do número.
    const novoEmail =
      telefoneChanged && isSyntheticEmail(oldEmail) ? phoneToSyntheticEmail(data.telefone) : oldEmail
    const emailChanged = novoEmail !== oldEmail

    if (emailChanged) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(data.targetUserId, {
        email: novoEmail,
        email_confirm: true,
      })

      if (authError) return { success: false, error: authError.message }
    }

    const { error: updateError } = await adminClient
      .from('users')
      .update({
        nome: data.nome,
        email: novoEmail,
        whatsapp: data.telefone,
        organization_name: data.organizationName || null,
      })
      .eq('id', data.targetUserId)

    if (updateError) {
      // Reverte o email no Auth se a tabela nao aceitar a mudanca, pra nao
      // deixar Auth e tabela inconsistentes silenciosamente.
      if (emailChanged) {
        await adminClient.auth.admin.updateUserById(data.targetUserId, {
          email: oldEmail,
          email_confirm: true,
        })
      }
      return { success: false, error: updateError.message }
    }

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'user_info_updated',
      resourceType: 'user',
      resourceId: data.targetUserId,
      metadata: {
        old_telefone: oldTelefone,
        new_telefone: data.telefone,
        old_organization_name: alvo.organization_name,
        new_organization_name: data.organizationName || null,
      },
    })

    revalidatePath(USERS_PAGE_PATH)
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}

// ── Update user segmento ────────────────────────────────────────────────────

export async function updateUserSegmento(
  targetUserId: string,
  segmentoId: string | null
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const data = updateUserSegmentoSchema.parse({ targetUserId, segmentoId })

    const { error } = await adminClient
      .from('users')
      .update({ segmento_id: data.segmentoId })
      .eq('id', data.targetUserId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'user_segmento_updated',
      resourceType: 'user',
      resourceId: data.targetUserId,
      metadata: { new_segmento_id: data.segmentoId },
    })

    revalidatePath(USERS_PAGE_PATH)
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}

// ── Deactivate user ─────────────────────────────────────────────────────────

export async function deactivateUser(
  targetUserId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const data = targetUserSchema.parse({ targetUserId })

    const { data: target } = await adminClient
      .from('users')
      .select('id, email')
      .eq('id', data.targetUserId)
      .maybeSingle()

    if (!target) return { success: false, error: 'Usuario nao encontrado.' }

    const { error } = await adminClient.auth.admin.updateUserById(data.targetUserId, {
      ban_duration: '876600h',
    })

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'user_deactivated',
      resourceType: 'user',
      resourceId: data.targetUserId,
      metadata: { target_email: (target as unknown as { email: string }).email },
    })

    revalidatePath(USERS_PAGE_PATH)
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}

// ── Reactivate user ─────────────────────────────────────────────────────────

export async function reactivateUser(
  targetUserId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const data = targetUserSchema.parse({ targetUserId })

    const { data: target } = await adminClient
      .from('users')
      .select('id, email')
      .eq('id', data.targetUserId)
      .maybeSingle()

    if (!target) return { success: false, error: 'Usuario nao encontrado.' }

    const { error } = await adminClient.auth.admin.updateUserById(data.targetUserId, {
      ban_duration: 'none',
    })

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'user_reactivated',
      resourceType: 'user',
      resourceId: data.targetUserId,
      metadata: { target_email: (target as unknown as { email: string }).email },
    })

    revalidatePath(USERS_PAGE_PATH)
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}

// ── Soft delete user ────────────────────────────────────────────────────────
// Diferente de deactivateUser (ban de auth, bloqueia login mas mantém a
// linha) — isso marca deleted_at e some da listagem, mas o registro
// continua no banco (recuperável).

export async function softDeleteUser(
  targetUserId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const data = targetUserSchema.parse({ targetUserId })

    const { data: target } = await adminClient
      .from('users')
      .select('id, email')
      .eq('id', data.targetUserId)
      .maybeSingle()

    if (!target) return { success: false, error: 'Usuario nao encontrado.' }

    const { error } = await adminClient
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', data.targetUserId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'user_soft_deleted',
      resourceType: 'user',
      resourceId: data.targetUserId,
      metadata: { target_email: (target as unknown as { email: string }).email },
    })

    revalidatePath(USERS_PAGE_PATH)
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}

// ── Create user with provisional password ───────────────────────────────────

/**
 * Cria a conta na hora, com senha provisória, **identificada por telefone**.
 *
 * O e-mail não é mais pedido: o Auth recebe o sintético derivado do número
 * (`phoneToSyntheticEmail`), que nunca aparece na UI. O que o admin
 * compartilha com a pessoa é telefone + senha provisória — as duas coisas que
 * a tela de login pede.
 */
export async function createUserWithProvisionalPassword(input: {
  telefone: string
  nome: string
  username: string
  role: RoleKey
  organizationName?: string
}): Promise<{
  success: boolean
  error: string | null
  username: string | null
  telefone: string | null
  temporaryPassword: string | null
  loginPath: string | null
}> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const data = createUserSchema.parse(input)
    const normalizedEmail = phoneToSyntheticEmail(data.telefone)
    const normalizedUsername = data.username.toLowerCase()

    // Telefone é a chave de negócio — dois usuários com o mesmo número não
    // conseguiriam nem logar (a resolução `telefone → conta` é única).
    const { data: existingPhone } = await adminClient
      .from('users')
      .select('id')
      .eq('whatsapp', data.telefone)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingPhone) {
      return {
        success: false,
        error: 'Ja existe um usuario cadastrado com este telefone.',
        username: null,
        telefone: null,
        temporaryPassword: null,
        loginPath: null,
      }
    }

    // Check username uniqueness
    const { data: existingUsername } = await adminClient
      .from('users')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle()

    if (existingUsername) {
      return {
        success: false,
        error: 'Este nome de usuario ja esta em uso.',
        username: null,
        telefone: null,
        temporaryPassword: null,
        loginPath: null,
      }
    }

    // Resolve role_id
    const { data: roleRow } = await adminClient
      .from('roles')
      .select('id')
      .eq('key', data.role)
      .maybeSingle()

    if (!roleRow) {
      return {
        success: false,
        error: 'Role invalida.',
        username: null,
        telefone: null,
        temporaryPassword: null,
        loginPath: null,
      }
    }

    const temporaryPassword = generateTemporaryPassword()

    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { nome: data.nome, role: data.role, phone_digits: data.telefone },
    })

    if (authError || !authData.user) {
      return {
        success: false,
        error: authError?.message ?? 'Erro ao criar usuario.',
        username: null,
        telefone: null,
        temporaryPassword: null,
        loginPath: null,
      }
    }

    const userId = authData.user.id

    // Upsert into users table (trigger may have already inserted a row)
    const { error: userError } = await adminClient
      .from('users')
      .upsert(
        {
          id: userId,
          email: normalizedEmail,
          nome: data.nome,
          username: normalizedUsername,
          role_id: roleRow.id,
          organization_name: data.organizationName || null,
          must_change_password: true,
          whatsapp: data.telefone,
        },
        { onConflict: 'id' }
      )

    if (userError) {
      await adminClient.auth.admin.deleteUser(userId)
      return {
        success: false,
        error: userError.message,
        username: null,
        telefone: null,
        temporaryPassword: null,
        loginPath: null,
      }
    }

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'user_created_with_provisional_password',
      resourceType: 'user',
      resourceId: userId,
      metadata: {
        created_telefone: data.telefone,
        role: data.role,
        organization_name: data.organizationName ?? null,
      },
    })

    revalidatePath(USERS_PAGE_PATH)

    return {
      success: true,
      error: null,
      username: normalizedUsername,
      telefone: data.telefone,
      temporaryPassword,
      loginPath: '/login',
    }
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
      username: null,
      telefone: null,
      temporaryPassword: null,
      loginPath: null,
    }
  }
}

// ── Create invitation (token-based link flow) ──────────────────────────────

export async function createInvitationLink(input: {
  email: string
  role: RoleKey
}): Promise<{
  success: boolean
  error: string | null
  token: string | null
  invitationPath: string | null
}> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const data = createInvitationSchema.parse(input)
    const normalizedEmail = data.email.toLowerCase()

    // Check if user already exists
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingUser) {
      return {
        success: false,
        error: 'Ja existe um usuario cadastrado com este e-mail.',
        token: null,
        invitationPath: null,
      }
    }

    // Delete old unaccepted invitation for same email
    await adminClient
      .from('invitations')
      .delete()
      .eq('email', normalizedEmail)
      .is('accepted_at', null)

    // Resolve role_id
    const { data: roleRow } = await adminClient
      .from('roles')
      .select('id')
      .eq('key', data.role)
      .maybeSingle()

    if (!roleRow) {
      return {
        success: false,
        error: 'Role invalida.',
        token: null,
        invitationPath: null,
      }
    }

    // Create invitation
    const { data: invitation, error: invitationError } = await adminClient
      .from('invitations')
      .insert({
        email: normalizedEmail,
        role: data.role,
        invited_by: actor.id,
      })
      .select('id, token')
      .single()

    if (invitationError || !invitation) {
      return {
        success: false,
        error: invitationError?.message ?? 'Nao foi possivel criar o convite.',
        token: null,
        invitationPath: null,
      }
    }

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'user_invitation_created',
      resourceType: 'invitation',
      resourceId: invitation.id,
      metadata: {
        invited_email: normalizedEmail,
        invitation_role: data.role,
      },
    })

    revalidatePath(USERS_PAGE_PATH)

    return {
      success: true,
      error: null,
      token: invitation.token,
      invitationPath: `/convite/${invitation.token}`,
    }
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
      token: null,
      invitationPath: null,
    }
  }
}

// ── Reset user password (nova senha provisória) ─────────────────────────────
// Diferente do link de recovery do Supabase: gera uma nova senha provisória
// na hora, aplica no Auth e força a troca no próximo login
// (must_change_password = true). O admin copia os campos e/ou envia por
// WhatsApp direto pro número cadastrado do usuário (users.whatsapp, já
// normalizado).

export async function resetUserPassword(
  targetUserId: string
): Promise<{
  success: boolean
  error: string | null
  username: string | null
  temporaryPassword: string | null
  whatsapp: string | null
}> {
  try {
    const { user: actor, adminClient } = await requireAdminWithClient()
    const data = targetUserSchema.parse({ targetUserId })

    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id, username, email, whatsapp')
      .eq('id', data.targetUserId)
      .is('deleted_at', null)
      .maybeSingle()

    if (targetError || !target) {
      return {
        success: false,
        error: 'Usuario nao encontrado.',
        username: null,
        temporaryPassword: null,
        whatsapp: null,
      }
    }

    const temporaryPassword = generateTemporaryPassword()

    const { error: authError } = await adminClient.auth.admin.updateUserById(
      data.targetUserId,
      { password: temporaryPassword }
    )

    if (authError) {
      return {
        success: false,
        error: authError.message,
        username: null,
        temporaryPassword: null,
        whatsapp: null,
      }
    }

    const { error: updateError } = await adminClient
      .from('users')
      .update({ must_change_password: true })
      .eq('id', data.targetUserId)

    if (updateError) {
      return {
        success: false,
        error: updateError.message,
        username: null,
        temporaryPassword: null,
        whatsapp: null,
      }
    }

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'user_password_reset',
      resourceType: 'user',
      resourceId: data.targetUserId,
      metadata: { target_email: (target as unknown as { email: string }).email },
    })

    revalidatePath(USERS_PAGE_PATH)

    return {
      success: true,
      error: null,
      username: (target as unknown as { username: string | null }).username,
      temporaryPassword,
      whatsapp: (target as unknown as { whatsapp: string | null }).whatsapp,
    }
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
      username: null,
      temporaryPassword: null,
      whatsapp: null,
    }
  }
}
