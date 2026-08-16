"use client"

import type { EmpresarioDashboardData } from "@/actions/dashboard"
import { LayoutConfigModal } from "@/components/dashboard/LayoutConfigModal"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { Button } from "@/components/ui/button"
import { useLayoutConfig } from "@/lib/hooks/useLayoutConfig"
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Tags,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

interface Props {
  data: EmpresarioDashboardData
  canManageUsers: boolean
}

const iconMap: Record<string, React.ElementType> = {
  Package,
  Tags,
  ClipboardList,
  FileText
};

const colorMap: Record<string, { bg: string, text: string }> = {
  produtos: { bg: 'bg-primary-500/10', text: 'text-primary-400' },
  categorias: { bg: 'bg-success-500/10', text: 'text-success-400' },
  segmentos: { bg: 'bg-pink-500/10', text: 'text-pink-400' },
  'lista-cotacao': { bg: 'bg-warning-500/10', text: 'text-warning-400' },
  cotacoes: { bg: 'bg-sky-500/10', text: 'text-sky-400' },
  ranking: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
};

export function EmpresarioDashboardContent({ data, canManageUsers }: Props) {
  const greeting = getGreeting()
  const {
    order,
    orderedModules,
    mounted,
    isModuleHidden,
    toggleModuleVisibility,
  } = useLayoutConfig('dashboard')
  const [layoutModalOpen, setLayoutModalOpen] = useState(false)

  const getModuleValue = (id: string) => {
    switch (id) {
      case 'produtos': return data.totalProdutos;
      case 'categorias': return data.totalCategorias;
      case 'segmentos': return data.totalSegmentos;
      case 'lista-cotacao': return data.totalItensCotacoes;
      case 'cotacoes': return data.cotacoesFechadas;
      default: return 0;
    }
  }

  const getModuleSubtitle = (id: string) => {
    switch (id) {
      case 'produtos': return "produtos cadastrados";
      case 'categorias': return "categorias cadastradas";
      case 'lista-cotacao': return "itens em cotações";
      case 'cotacoes': return "cotações fechadas";
      default: return "";
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Hero Section ── */}
      <div className="animate-slide-up flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            {greeting}, {data.userName}! 👋
          </h1>
          <p className="text-neutral-400 font-medium">
            {data.cotacoesAbertas > 0 ? (
              <>
                Você tem{" "}
                <span className="text-primary-400 font-bold">
                  {data.cotacoesAbertas} cotaç{data.cotacoesAbertas === 1 ? "ão" : "ões"}
                </span>{" "}
                aguardando proposta
              </>
            ) : (
              "Sua central de orçamentos e inteligência comercial."
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setLayoutModalOpen(true)}
            className="h-12 border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-white/5 transition-all shadow-sm"
            title="Editar Layout"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Editar Layout
          </Button>
          
          <Link href="/empresario/cotacoes/nova">
            <Button
              size="lg"
              className="shadow-lg shadow-primary-500/20 px-6 h-12 bg-primary-600 hover:bg-primary-500 text-white border-none cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/30 hover:scale-[1.02]"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nova Cotação
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Modular Hub ── */}
      {mounted && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-slide-up-delay-2 mt-8 auto-rows-fr items-stretch">
          {orderedModules.map((mod, i) => {
            const IconComponent = iconMap[mod.icon] || Package;
            const colors = colorMap[mod.id] || colorMap.produtos;
            const value = getModuleValue(mod.id);
            const subtitle = getModuleSubtitle(mod.id);

            return (
              <Link key={mod.id} href={mod.href} className="block h-full">
                <div 
                  className="group flex flex-col justify-between p-8 rounded-2xl border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-800 hover:bg-white dark:hover:bg-neutral-800 transition-all duration-300 h-full shadow-sm hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1 hover:border-primary-500/30 dark:hover:border-white/[0.12] cursor-pointer"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className={`h-16 w-16 rounded-[var(--radius-md)] flex items-center justify-center border border-neutral-100 dark:border-white/[0.04] ${colors.bg} ${colors.text} transition-transform duration-300 group-hover:scale-110 shadow-inner`}>
                      <IconComponent className="h-8 w-8" />
                    </div>
                    <ArrowRight className="h-6 w-6 text-neutral-400 dark:text-neutral-600 dark:group-hover:text-neutral-300 group-hover:translate-x-1 transition-colors duration-300" />
                  </div>
                  <div className="mt-auto">
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight dark:group-hover:text-primary-100 transition-colors">{mod.label}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-neutral-900 dark:text-neutral-100 tabular-nums tracking-tight">
                        <AnimatedNumber value={value as number} loading={!mounted} />
                      </span>
                      <span className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">{subtitle}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Atividades Recentes ── */}
      {canManageUsers && (
        <div className="rounded-2xl border border-warning-500/20 bg-gradient-to-br from-warning-500/10 via-white to-white dark:via-neutral-800 dark:to-neutral-900 p-6 lg:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-warning-500/15 text-warning-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Gestao de usuarios</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  Gerencie convites, papeis e acessos da plataforma com auditoria.
                </p>
              </div>
            </div>

            <Link href="/empresario/usuarios">
              <Button className="h-11 bg-warning-500 text-neutral-900 hover:bg-warning-400">
                Abrir painel
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-800 p-6 lg:p-8">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-6">
          Atividades Recentes
        </h3>
        <RecentActivity items={data.recentActivity} />
      </div>

      <LayoutConfigModal
        open={layoutModalOpen}
        onClose={() => setLayoutModalOpen(false)}
        initialOrder={order}
        initialTab="dashboard"
        isSuperAdmin={false}
        isModuleHidden={isModuleHidden}
        onToggleVisibility={toggleModuleVisibility}
      />
    </div>
  )
}
