'use server'

/**
 * margem.ts — leitura/gravação da configuração de margem (site_settings).
 *
 * A decisão de cálculo em si é pura e mora em `src/lib/margem.ts`; aqui só há
 * I/O + autorização, seguindo a convenção "puro vs. server" do projeto.
 *
 * Escopo: linha global de `site_settings` (organization_id IS NULL), o mesmo
 * padrão já usado por tema/home (migration 014). A tabela é org-ready — o dia
 * em que o painel virar multi-tenant, muda só o filtro de leitura.
 */

import { requireAdminWithClient, requireAuth, writeAuditLog } from '@/lib/auth/guard'
import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_MARGEM_CONFIG,
  normalizarMargemConfig,
  type MargemConfig,
} from '@/lib/margem'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const margemConfigSchema = z.object({
  margem_percent: z
    .number({ message: 'Informe a margem em porcentagem.' })
    .min(0, 'A margem não pode ser negativa.')
    .max(999, 'Margem fora do intervalo aceito.'),
  tolerancia_percent: z
    .number({ message: 'Informe a tolerância em porcentagem.' })
    .min(0, 'A tolerância não pode ser negativa.')
    .max(100, 'A tolerância não pode passar de 100%.'),
  metodo: z.enum(['markup', 'desconto'], { message: 'Método de cálculo inválido.' }),
})

const MARGEM_PATHS = ['/empresario/ajustes', '/empresario/cotacoes'] as const

function toErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'Dados inválidos.'
  if (error instanceof Error) return error.message
  return 'Ocorreu um erro inesperado.'
}

/**
 * Config ativa. NUNCA lança: a tabela de comparação depende disso pra
 * renderizar e um erro de leitura (ou a migration 018 ainda não rodada no
 * banco real — ver histórico de divergência migration-vs-produção no
 * CLAUDE.md) deve cair no padrão do sistema, não quebrar a tela.
 */
export async function getMargemConfig(): Promise<{ config: MargemConfig; error: string | null }> {
  try {
    await requireAuth()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('site_settings')
      .select('margem_config')
      .is('organization_id', null)
      .maybeSingle()

    if (error || !data) {
      return { config: { ...DEFAULT_MARGEM_CONFIG }, error: error?.message ?? null }
    }

    return { config: normalizarMargemConfig(data.margem_config), error: null }
  } catch (error) {
    return { config: { ...DEFAULT_MARGEM_CONFIG }, error: toErrorMessage(error) }
  }
}

export async function updateMargemConfig(
  input: unknown,
): Promise<{ success: boolean; error: string | null; config: MargemConfig }> {
  try {
    const { user, adminClient } = await requireAdminWithClient()
    const parsed = margemConfigSchema.parse(input)

    const { error } = await adminClient
      .from('site_settings')
      .update({ margem_config: parsed, updated_by: user.id })
      .is('organization_id', null)
      .select('id')

    if (error) {
      return { success: false, error: error.message, config: normalizarMargemConfig(parsed) }
    }

    await writeAuditLog({
      actorUserId: user.id,
      action: 'margem_config_updated',
      resourceType: 'site_settings',
    })

    MARGEM_PATHS.forEach((path) => revalidatePath(path))

    return { success: true, error: null, config: normalizarMargemConfig(parsed) }
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
      config: { ...DEFAULT_MARGEM_CONFIG },
    }
  }
}
