import { getHomeBlocksDraft, getThemeSettings } from '@/actions/theme'
import { requireAdmin } from '@/lib/auth/guard'
import { Palette } from 'lucide-react'
import { AparenciaTabs } from './AparenciaTabs'

export const metadata = {
  title: 'Aparência — Venda Mais',
}

export default async function AparenciaPage() {
  // Segunda camada de defesa (a primeira é o layout de /empresario/*) —
  // mesmo padrão de /empresario/usuarios/page.tsx.
  await requireAdmin()

  const { preset, tokens, error } = await getThemeSettings()
  const { blocks: homeDraft } = await getHomeBlocksDraft()

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary-500/15 flex items-center justify-center">
            <Palette className="h-4.5 w-4.5 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">Aparência</h1>
        </div>
        <p className="text-sm text-neutral-500 ml-10">
          Tema visual e conteúdo da página inicial.
        </p>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 rounded-xl px-5 py-4 text-sm text-danger-400">
          Erro ao carregar configurações de tema: {error}
        </div>
      )}

      <AparenciaTabs initialPreset={preset} initialTokens={tokens} initialHomeDraft={homeDraft} />
    </div>
  )
}
