'use server'

import { getInvitationByToken } from '@/actions/invitations'
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy'
import { isValidPhone, normalizePhone } from '@/lib/phone'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RoleKey } from '@/lib/types/database'
import { z } from 'zod'

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Convite invalido.'),
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  username: z
    .string()
    .trim()
    .min(3, 'Informe um nome de usuario com ao menos 3 caracteres.')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Use apenas letras, numeros e underline.'),
  // O convite é endereçado a um e-mail, mas quem entra na plataforma entra
  // pelo telefone — sem ele a conta nasceria sem porta de entrada.
  telefone: z
    .string()
    .trim()
    .refine(isValidPhone, 'Informe um telefone valido com DDD (ex.: (71) 99999-9999).')
    .transform((v) => normalizePhone(v)),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `A senha deve ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.`),
})

/**
 * Aceite do convite por token (fluxo legado — nenhuma tela cria convites hoje;
 * o caminho vivo é `createUserWithProvisionalPassword` ou o cadastro público
 * por telefone). Mantido funcional para links já emitidos: o e-mail do convite
 * continua sendo o do Auth, mas a conta nasce com telefone, que é o que a tela
 * de login pede.
 */
export async function acceptManagedInvitation(data: {
  token: string
  nome: string
  username: string
  telefone: string
  password: string
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const input = acceptInvitationSchema.parse(data)
    const { invitation, error: invitationError } = await getInvitationByToken(input.token)

    if (invitationError || !invitation) {
      return { success: false, error: invitationError ?? 'Convite invalido.' }
    }

    const roleKey = (invitation.role ?? 'supplier') as RoleKey
    const adminClient = createAdminClient()
    const normalizedUsername = input.username.toLowerCase()

    // Check username uniqueness in users table
    const { data: existingUsername } = await adminClient
      .from('users')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle()

    if (existingUsername) {
      return { success: false, error: 'Este nome de usuario ja esta em uso.' }
    }

    const { data: existingPhone } = await adminClient
      .from('users')
      .select('id')
      .eq('whatsapp', input.telefone)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingPhone) {
      return { success: false, error: 'Ja existe uma conta com este telefone.' }
    }

    // Resolve role_id
    const { data: roleRow } = await adminClient
      .from('roles')
      .select('id')
      .eq('key', roleKey)
      .maybeSingle()

    if (!roleRow) {
      return { success: false, error: 'Role invalida.' }
    }

    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: invitation.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        nome: input.nome,
        role: roleKey,
        phone_digits: input.telefone,
      },
    })

    if (authError || !authData.user) {
      return { success: false, error: authError?.message ?? 'Erro ao criar usuario.' }
    }

    const userId = authData.user.id

    // Upsert into users table (trigger may have already inserted a row)
    const { error: userError } = await adminClient
      .from('users')
      .upsert(
        {
          id: userId,
          email: invitation.email,
          nome: input.nome,
          username: normalizedUsername,
          whatsapp: input.telefone,
          role_id: roleRow.id,
          must_change_password: false,
        },
        { onConflict: 'id' }
      )

    if (userError) {
      await adminClient.auth.admin.deleteUser(userId)
      return { success: false, error: userError.message }
    }

    // Mark invitation as accepted
    const { error: markAcceptedError } = await adminClient
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', input.token)

    if (markAcceptedError) {
      return { success: false, error: markAcceptedError.message }
    }

    return { success: true, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Dados invalidos.' }
    }

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: 'Ocorreu um erro inesperado.' }
  }
}
