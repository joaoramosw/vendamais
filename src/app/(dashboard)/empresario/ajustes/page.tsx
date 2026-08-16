import { getMargemConfig } from '@/actions/margem'
import { requireAuth } from '@/lib/auth/guard'
import { SlidersHorizontal } from 'lucide-react'
import { AjustesClient } from './AjustesClient'

export const metadata = {
  title: 'Markup — Venda Mais',
}

/**
 * Página de Markup — substitui o modal "Ajustes da tabela" que abria por
 * cima da comparação de cotações. O que era configurável ali (ordem e nome
 * das colunas) continua aqui, junto com a nova seção de margem/valor ideal,
 * que precisa de espaço pro preview em tempo real.
 *
 * `requireAuth` e não `requireAdmin`: as preferências de coluna são do
 * navegador de cada usuário e todo mundo que vê a tabela precisa poder
 * ajustá-las. A margem é a parte restrita — gravar exige admin (ver
 * `updateMargemConfig`), então a seção entra em modo leitura para os demais.
 */
export default async function AjustesPage() {
  const user = await requireAuth()
  const { config, error } = await getMargemConfig()

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary-500/15 flex items-center justify-center">
            <SlidersHorizontal className="h-4.5 w-4.5 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
            Markup
          </h1>
        </div>
        <p className="text-sm text-neutral-500 ml-10">
          Margem de compra e colunas da comparação de cotações.
        </p>
      </div>

      {error && (
        <div className="bg-warning-500/10 border border-warning-500/20 rounded-xl px-5 py-4 text-sm text-warning-600 dark:text-warning-400">
          Não foi possível ler a configuração salva ({error}). Os valores abaixo são os padrões do
          sistema.
        </div>
      )}

      <AjustesClient initialConfig={config} podeEditarMargem={user.role === 'admin'} />
    </div>
  )
}
