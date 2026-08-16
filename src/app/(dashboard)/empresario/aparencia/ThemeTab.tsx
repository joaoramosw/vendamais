'use client'

import { setThemePreset, updateThemeTokens } from '@/actions/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { showToast } from '@/components/ui/toast'
import { LogoUploader } from '@/components/theme/LogoUploader'
import { ThemePreview } from '@/components/theme/ThemePreview'
import { isValidHex } from '@/lib/theme/color-scale'
import { contrastRatio, meetsWcagAA } from '@/lib/theme/contrast'
import { PRESET_LABELS, THEME_PRESETS } from '@/lib/theme/presets'
import type { ThemeColors, ThemeTokens } from '@/lib/theme/types'
import { cn } from '@/lib/utils'
import { Check, Moon, Sun } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'primary', label: 'Primária' },
  { key: 'secondary', label: 'Secundária' },
  { key: 'success', label: 'Sucesso' },
  { key: 'warning', label: 'Aviso' },
  { key: 'danger', label: 'Erro' },
  { key: 'info', label: 'Informação' },
  { key: 'background', label: 'Fundo' },
  { key: 'surface', label: 'Superfície' },
  { key: 'border', label: 'Borda' },
  { key: 'textPrimary', label: 'Texto primário' },
  { key: 'textSecondary', label: 'Texto secundário' },
]

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
}) {
  const valid = isValidHex(value)
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={valid ? value : '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-9 w-9 shrink-0 rounded-[var(--radius-sm)] border border-white/10 bg-transparent cursor-pointer p-0"
      />
      <div className="flex-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          error={valid ? undefined : 'Hex inválido'}
        />
      </div>
      <span className="w-28 shrink-0 text-xs text-neutral-500">{label}</span>
    </div>
  )
}

function ContrastBadge({ label, ratio, ok }: { label: string; ratio: number; ok: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        ok
          ? 'bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-300'
          : 'bg-warning-50 dark:bg-warning-950/40 text-warning-700 dark:text-warning-300'
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : null}
      {label}: {ratio.toFixed(2)}:1 {ok ? '(OK)' : '(abaixo do mínimo 4.5:1)'}
    </span>
  )
}

export function ThemeTab({
  initialPreset,
  initialTokens,
}: {
  initialPreset: string
  initialTokens: ThemeTokens
}) {
  const [preset, setPreset] = useState(initialPreset)
  const [tokens, setTokens] = useState<ThemeTokens>(initialTokens)
  const [isSaving, startSaveTransition] = useTransition()
  const [isSwitchingPreset, startPresetTransition] = useTransition()
  const router = useRouter()

  const setColor = (key: keyof ThemeColors, hex: string) => {
    setTokens((prev) => ({ ...prev, colors: { ...prev.colors, [key]: hex } }))
  }

  const contrastBg = isValidHex(tokens.colors.textPrimary) && isValidHex(tokens.colors.background)
    ? contrastRatio(tokens.colors.textPrimary, tokens.colors.background)
    : 0
  const contrastSurface = isValidHex(tokens.colors.textPrimary) && isValidHex(tokens.colors.surface)
    ? contrastRatio(tokens.colors.textPrimary, tokens.colors.surface)
    : 0

  const handlePresetSelect = (key: string) => {
    if (key === preset) return
    startPresetTransition(async () => {
      const result = await setThemePreset(key)
      if (result.error) {
        showToast(result.error, 'error')
        return
      }
      setPreset(key)
      setTokens(THEME_PRESETS[key as keyof typeof THEME_PRESETS])
      showToast('Preset aplicado.', 'success')
      // Re-render a árvore RSC (incluindo o <html> com as CSS vars do tema)
      // para o preset valer imediatamente, sem recarregar a página.
      router.refresh()
    })
  }

  const handleSave = () => {
    startSaveTransition(async () => {
      const result = await updateThemeTokens(tokens)
      if (result.error) {
        showToast(result.error, 'error')
        return
      }
      showToast('Tema salvo.', 'success')
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        {/* Presets */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-300">Preset</label>
          <div className="flex gap-2">
            {Object.keys(THEME_PRESETS).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetSelect(key)}
                disabled={isSwitchingPreset}
                className={cn(
                  'flex-1 rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50',
                  preset === key
                    ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                    : 'border-white/10 text-neutral-400 hover:text-neutral-200'
                )}
              >
                {PRESET_LABELS[key as keyof typeof PRESET_LABELS] ?? key}
              </button>
            ))}
          </div>
        </div>

        {/* Modo claro/escuro */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-300">Modo</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTokens((prev) => ({ ...prev, colorScheme: 'dark' }))}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-medium cursor-pointer',
                tokens.colorScheme === 'dark'
                  ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                  : 'border-white/10 text-neutral-400'
              )}
            >
              <Moon className="h-4 w-4" /> Escuro
            </button>
            <button
              type="button"
              onClick={() => setTokens((prev) => ({ ...prev, colorScheme: 'light' }))}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-medium cursor-pointer',
                tokens.colorScheme === 'light'
                  ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                  : 'border-white/10 text-neutral-400'
              )}
            >
              <Sun className="h-4 w-4" /> Claro
            </button>
          </div>
        </div>

        {/* Cores */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-300">Cores</label>
          <div className="space-y-2">
            {COLOR_FIELDS.map(({ key, label }) => (
              <ColorField key={key} label={label} value={tokens.colors[key]} onChange={(hex) => setColor(key, hex)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <ContrastBadge label="Texto × Fundo" ratio={contrastBg} ok={meetsWcagAA(tokens.colors.textPrimary, tokens.colors.background)} />
            <ContrastBadge label="Texto × Superfície" ratio={contrastSurface} ok={meetsWcagAA(tokens.colors.textPrimary, tokens.colors.surface)} />
          </div>
        </div>

        {/* Raio */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-300">
            Raio das bordas ({tokens.radiusScale.toFixed(2)}x)
          </label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={tokens.radiusScale}
            onChange={(e) => setTokens((prev) => ({ ...prev, radiusScale: Number(e.target.value) }))}
            className="w-full accent-primary-500"
          />
        </div>

        {/* Tipografia + densidade */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Fonte</label>
            <select
              value={tokens.typography.fontFamily}
              onChange={(e) =>
                setTokens((prev) => ({
                  ...prev,
                  typography: { ...prev.typography, fontFamily: e.target.value as ThemeTokens['typography']['fontFamily'] },
                }))
              }
              className="w-full border rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border-neutral-200 dark:border-white/10 outline-none cursor-pointer"
            >
              <option value="inter">Inter</option>
              <option value="jetbrains">JetBrains Mono</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Densidade</label>
            <select
              value={tokens.density}
              onChange={(e) => setTokens((prev) => ({ ...prev, density: e.target.value as ThemeTokens['density'] }))}
              className="w-full border rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border-neutral-200 dark:border-white/10 outline-none cursor-pointer"
            >
              <option value="compact">Compacta</option>
              <option value="comfortable">Confortável</option>
              <option value="spacious">Espaçosa</option>
            </select>
          </div>
        </div>

        <LogoUploader logoUrl={tokens.logoUrl} onChange={(logoUrl) => setTokens((prev) => ({ ...prev, logoUrl }))} />

        <Button onClick={handleSave} loading={isSaving} className="w-full">
          Salvar tema
        </Button>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-6 self-start">
        <ThemePreview tokens={tokens} />
      </div>
    </div>
  )
}
