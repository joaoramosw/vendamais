'use client'

import { tokensToCssVars } from '@/lib/theme/css-vars'
import type { ThemeTokens } from '@/lib/theme/types'
import { CheckCircle2 } from 'lucide-react'

/**
 * Mock pequeno (não a home inteira) pra pré-visualizar o rascunho de tokens
 * antes de salvar. Custom properties herdam normalmente dentro de qualquer
 * elemento — não precisa ser o <html> pra funcionar.
 */
export function ThemePreview({ tokens }: { tokens: ThemeTokens }) {
  const isDark = tokens.colorScheme === 'dark'

  return (
    <div
      style={tokensToCssVars(tokens)}
      className={isDark ? 'dark' : ''}
    >
      <div className="rounded-[var(--radius-lg)] border border-neutral-200 dark:border-white/[0.06] bg-neutral-50 dark:bg-neutral-900 p-6 space-y-4">
        <div className="rounded-[var(--radius-lg)] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/[0.06] p-5 space-y-3">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Pré-visualização</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Assim ficam os textos e superfícies com esses tokens.
          </p>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button className="rounded-[var(--radius-md)] bg-primary-500 text-white text-sm font-medium px-4 py-2">
              Botão primário
            </button>
            <button className="rounded-[var(--radius-md)] bg-secondary-500 text-white text-sm font-medium px-4 py-2">
              Secundário
            </button>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-300 text-xs font-medium px-2.5 py-1">
              <CheckCircle2 className="h-3 w-3" />
              Sucesso
            </span>
            <span className="inline-flex items-center rounded-full bg-danger-50 dark:bg-danger-950/40 text-danger-700 dark:text-danger-300 text-xs font-medium px-2.5 py-1">
              Erro
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
