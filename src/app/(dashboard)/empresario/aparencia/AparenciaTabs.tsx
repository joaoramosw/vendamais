'use client'

import { cn } from '@/lib/utils'
import type { ThemeTokens } from '@/lib/theme/types'
import type { HomeBlock } from '@/lib/theme/home-blocks'
import { LayoutTemplate, Paintbrush } from 'lucide-react'
import { useState } from 'react'
import { HomeTab } from './HomeTab'
import { ThemeTab } from './ThemeTab'

type Tab = 'tema' | 'home'

const TABS: { key: Tab; label: string; icon: typeof Paintbrush }[] = [
  { key: 'tema', label: 'Tema', icon: Paintbrush },
  { key: 'home', label: 'Página inicial', icon: LayoutTemplate },
]

export function AparenciaTabs({
  initialPreset,
  initialTokens,
  initialHomeDraft,
}: {
  initialPreset: string
  initialTokens: ThemeTokens
  initialHomeDraft: HomeBlock[]
}) {
  const [tab, setTab] = useState<Tab>('tema')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer',
              tab === key
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'tema' && <ThemeTab initialPreset={initialPreset} initialTokens={initialTokens} />}
      {tab === 'home' && <HomeTab initialDraft={initialHomeDraft} />}
    </div>
  )
}
