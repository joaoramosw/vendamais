'use server'

import { requireAuth } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSyntheticEmail, isValidPhone, normalizePhone, phoneToSyntheticEmail } from '@/lib/phone'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

/**
 * Telefone é o identificador da conta (login) — obrigatório aqui pelo mesmo
 * motivo que em admin-users: sem ele a pessoa não entra, já que nenhuma tela
 * de auth pede e-mail.
 */
const telefoneField = z
  .string()
  .trim()
  .refine(isValidPhone, 'Informe um telefone valido com DDD (ex.: (71) 99999-9999).')
  .transform((v) => normalizePhone(v))

const updateOwnProfileSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  telefone: telefoneField,
  organizationName: z.string().trim().max(120).optional(),
})

function toErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'Dados invalidos.'
  if (error instanceof Error) return error.message
  return 'Ocorreu um erro inesperado.'
}

export type OwnProfile = {
  id: string
  nome: string
  organization_name: string | null
  /** Telefone de login (`users.whatsapp`). */
  whatsapp: string | null
}

export async function getOwnProfile(): Promise<{ profile: OwnProfile | null; error: string | null }> {
  const currentUser = await requireAuth()
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('users')
    .select('id, nome, organization_name, whatsapp')
    .eq('id', currentUser.id)
    .maybeSingle()

  if (error || !data) {
    return { profile: null, error: error?.message ?? 'Perfil nao encontrado.' }
  }

  return { profile: data, error: null }
}

/**
 * Atualiza o próprio perfil. O e-mail não é editável (nem exibido): em conta
 * criada por telefone ele é sintético e derivado do número — trocar o telefone
 * o atualiza junto. Conta legada com e-mail real mantém o endereço, porque o
 * login resolve `telefone → users.email → Auth`.
 */
export async function updateOwnProfile(input: {
  nome: string
  telefone: string
  organizationName?: string
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const currentUser = await requireAuth()
    const data = updateOwnProfileSchema.parse(input)
    const adminClient = createAdminClient()

    const { data: current, error: currentError } = await adminClient
      .from('users')
      .select('email, whatsapp')
      .eq('id', currentUser.id)
      .maybeSingle()

    if (currentError || !current) {
      return { success: false, error: 'Perfil nao encontrado.' }
    }

    const oldEmail = current.email as string
    const telefoneChanged = data.telefone !== current.whatsapp

    if (telefoneChanged) {
      const { data: existingPhone } = await adminClient
        .from('users')
        .select('id')
        .eq('whatsapp', data.telefone)
        .is('deleted_at', null)
        .neq('id', currentUser.id)
        .maybeSingle()

      if (existingPhone) {
        return { success: false, error: 'Ja existe uma conta com este telefone.' }
      }
    }

    const novoEmail =
      telefoneChanged && isSyntheticEmail(oldEmail) ? phoneToSyntheticEmail(data.telefone) : oldEmail
    const emailChanged = novoEmail !== oldEmail

    if (emailChanged) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(currentUser.id, {
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
        organization_name: data.organizationName || null,
        whatsapp: data.telefone,
      })
      .eq('id', currentUser.id)

    if (updateError) {
      // Reverte o email no Auth se a tabela nao aceitar a mudanca, pra nao
      // deixar Auth e tabela inconsistentes silenciosamente.
      if (emailChanged) {
        await adminClient.auth.admin.updateUserById(currentUser.id, {
          email: oldEmail,
          email_confirm: true,
        })
      }
      return { success: false, error: updateError.message }
    }

    revalidatePath('/fornecedor/configuracoes')
    revalidatePath('/fornecedor/cotacoes')

    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}
