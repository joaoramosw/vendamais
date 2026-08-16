'use server'

import { requireAdmin, requireAdminWithClient, writeAuditLog } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTheme } from '@/lib/theme/get-theme'
import { DEFAULT_THEME_TOKENS } from '@/lib/theme/defaults'
import { THEME_PRESETS } from '@/lib/theme/presets'
import { themePresetKeySchema, themeTokensSchema } from '@/lib/theme/schemas'
import type { ThemePresetKey, ThemeTokens } from '@/lib/theme/types'
import { DEFAULT_HOME_BLOCKS, homeBlocksArraySchema, type HomeBlock } from '@/lib/theme/home-blocks'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'

type AdminClient = ReturnType<typeof createAdminClient>

function toErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Dados inválidos.'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Ocorreu um erro inesperado.'
}

const SITE_SETTINGS_PATHS = ['/', '/empresario/aparencia'] as const

function invalidateTheme() {
  // 'max' = purga a tag imediatamente, independente do profile de cache life
  // configurado (não passamos nenhum em unstable_cache, então fica no default).
  revalidateTag('theme', 'max')
  SITE_SETTINGS_PATHS.forEach((path) => revalidatePath(path))
}

// ── Leitura (admin, pro editor) ─────────────────────────────────────────────

export async function getThemeSettings(): Promise<{
  preset: string
  tokens: ThemeTokens
  error?: string
}> {
  try {
    await requireAdmin()
    const result = await getTheme()
    return { preset: result.preset, tokens: result.tokens }
  } catch (error) {
    return { preset: 'default', tokens: DEFAULT_THEME_TOKENS, error: toErrorMessage(error) }
  }
}

// ── Escrita: tokens ──────────────────────────────────────────────────────────

export async function updateThemeTokens(tokens: unknown): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user, adminClient } = await requireAdminWithClient()
    const parsed = themeTokensSchema.parse(tokens)

    const { error } = await adminClient
      .from('site_settings')
      .update({ theme_tokens: parsed, updated_by: user.id })
      .is('organization_id', null)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      actorUserId: user.id,
      action: 'theme_tokens_updated',
      resourceType: 'site_settings',
    })
    invalidateTheme()
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}

// ── Escrita: preset ────────────────────────────────────────────────────────

export async function setThemePreset(presetKey: unknown): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user, adminClient } = await requireAdminWithClient()
    const key = themePresetKeySchema.parse(presetKey) as ThemePresetKey

    if (!(key in THEME_PRESETS)) {
      return { success: false, error: 'Preset inválido.' }
    }

    // Reseta os overrides ao trocar de preset — o admin começa do zero em
    // cima do novo preset, sem cores de um preset anterior vazando.
    const { error } = await adminClient
      .from('site_settings')
      .update({ theme_preset: key, theme_tokens: {}, updated_by: user.id })
      .is('organization_id', null)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      actorUserId: user.id,
      action: 'theme_preset_changed',
      resourceType: 'site_settings',
      metadata: { preset: key },
    })
    invalidateTheme()
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}

// ── Logo ─────────────────────────────────────────────────────────────────────

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_ALLOWED_TYPES = ['image/webp', 'image/avif', 'image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml']

function extensionForContentType(contentType: string): string {
  if (contentType.includes('svg')) return 'svg'
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('avif')) return 'avif'
  return 'webp'
}

async function persistLogoUrl(adminClient: AdminClient, userId: string, logoUrl: string) {
  const { data: current } = await adminClient
    .from('site_settings')
    .select('theme_tokens')
    .is('organization_id', null)
    .maybeSingle()

  const currentTokens = (current?.theme_tokens ?? {}) as Partial<ThemeTokens>
  const nextTokens = { ...currentTokens, logoUrl }

  await adminClient
    .from('site_settings')
    .update({ theme_tokens: nextTokens, updated_by: userId })
    .is('organization_id', null)
}

export async function uploadThemeLogo(formData: FormData): Promise<{ url?: string; error?: string }> {
  try {
    const { user, adminClient } = await requireAdminWithClient()

    const file = formData.get('file') as File
    if (!file) return { error: 'Nenhum arquivo selecionado.' }

    if (file.size > LOGO_MAX_BYTES) {
      return { error: 'Logo muito grande. Máximo: 2 MB.' }
    }
    if (!LOGO_ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      return { error: `Formato inválido (${file.type}). Aceitos: JPG, PNG, WebP, AVIF, SVG.` }
    }

    const ext = extensionForContentType(file.type)
    const storagePath = `logo/logo-${Date.now()}.${ext}`

    const { error: uploadError } = await adminClient.storage
      .from('site-assets')
      .upload(storagePath, file, {
        contentType: file.type,
        cacheControl: `${60 * 60 * 24 * 30}`,
        upsert: true,
      })

    if (uploadError) return { error: uploadError.message }

    const { data: publicUrl } = adminClient.storage.from('site-assets').getPublicUrl(storagePath)

    await persistLogoUrl(adminClient, user.id, publicUrl.publicUrl)
    await writeAuditLog({ actorUserId: user.id, action: 'theme_logo_uploaded', resourceType: 'site_settings' })
    invalidateTheme()

    return { url: publicUrl.publicUrl }
  } catch (error) {
    return { error: toErrorMessage(error) }
  }
}

/**
 * Faz download de uma imagem via URL externa e rehospeda no Storage — nunca
 * guarda o link externo cru (mesmo padrão de uploadImageFromUrl em
 * src/actions/products.ts).
 */
export async function setThemeLogoFromUrl(imageUrl: string): Promise<{ url?: string; error?: string }> {
  try {
    const { user, adminClient } = await requireAdminWithClient()

    let parsedUrl: URL
    try {
      parsedUrl = new URL(imageUrl.trim())
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        return { error: 'URL deve usar https ou http.' }
      }
    } catch {
      return { error: 'URL inválida.' }
    }

    let imageBuffer: ArrayBuffer
    let contentType: string
    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: { 'User-Agent': 'VendaMais-Bot/1.0' },
        signal: AbortSignal.timeout(15_000),
      })

      if (!response.ok) {
        return { error: `Não foi possível baixar a imagem (HTTP ${response.status}).` }
      }

      contentType = response.headers.get('content-type') ?? ''
      if (!contentType.startsWith('image/')) {
        return { error: 'A URL não aponta para uma imagem válida.' }
      }

      const contentLength = Number(response.headers.get('content-length') ?? 0)
      if (contentLength > LOGO_MAX_BYTES) {
        return { error: 'Imagem muito grande. Máximo: 2 MB.' }
      }

      imageBuffer = await response.arrayBuffer()
      if (imageBuffer.byteLength > LOGO_MAX_BYTES) {
        return { error: 'Imagem baixada excede 2 MB.' }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        return { error: 'Timeout ao baixar imagem. Tente outra URL.' }
      }
      return { error: 'Erro ao baixar imagem da URL fornecida.' }
    }

    const ext = extensionForContentType(contentType)
    const storagePath = `logo/logo-${Date.now()}.${ext}`

    const { error: uploadError } = await adminClient.storage
      .from('site-assets')
      .upload(storagePath, imageBuffer, {
        contentType,
        cacheControl: `${60 * 60 * 24 * 30}`,
        upsert: true,
      })

    if (uploadError) return { error: uploadError.message }

    const { data: publicUrl } = adminClient.storage.from('site-assets').getPublicUrl(storagePath)

    await persistLogoUrl(adminClient, user.id, publicUrl.publicUrl)
    await writeAuditLog({ actorUserId: user.id, action: 'theme_logo_set_from_url', resourceType: 'site_settings' })
    invalidateTheme()

    return { url: publicUrl.publicUrl }
  } catch (error) {
    return { error: toErrorMessage(error) }
  }
}

// ── Editor da home: rascunho vs publicado ───────────────────────────────────

export async function getHomeBlocksDraft(): Promise<{ blocks: HomeBlock[]; error?: string }> {
  try {
    await requireAdmin()
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('site_settings')
      .select('home_blocks_draft')
      .is('organization_id', null)
      .maybeSingle()

    if (error || !data) {
      return { blocks: DEFAULT_HOME_BLOCKS, error: error?.message }
    }

    const parsed = homeBlocksArraySchema.safeParse(data.home_blocks_draft)
    if (!parsed.success || parsed.data.length === 0) {
      return { blocks: DEFAULT_HOME_BLOCKS }
    }

    return { blocks: parsed.data }
  } catch (error) {
    return { blocks: DEFAULT_HOME_BLOCKS, error: toErrorMessage(error) }
  }
}

export async function updateHomeBlocksDraft(blocks: unknown): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user, adminClient } = await requireAdminWithClient()
    const parsed = homeBlocksArraySchema.parse(blocks)

    const { error } = await adminClient
      .from('site_settings')
      .update({ home_blocks_draft: parsed, updated_by: user.id })
      .is('organization_id', null)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({ actorUserId: user.id, action: 'home_blocks_draft_updated', resourceType: 'site_settings' })
    // Rascunho não afeta o site público — sem revalidatePath('/') aqui.
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}

export async function publishHomeBlocks(): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user, adminClient } = await requireAdminWithClient()

    const { data: current, error: readError } = await adminClient
      .from('site_settings')
      .select('home_blocks_draft')
      .is('organization_id', null)
      .maybeSingle()

    if (readError || !current) {
      return { success: false, error: readError?.message ?? 'Configuração não encontrada.' }
    }

    const draft = homeBlocksArraySchema.parse(current.home_blocks_draft)

    const { error } = await adminClient
      .from('site_settings')
      .update({ home_blocks_published: draft, updated_by: user.id })
      .is('organization_id', null)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({ actorUserId: user.id, action: 'home_blocks_published', resourceType: 'site_settings' })
    invalidateTheme()
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
}
