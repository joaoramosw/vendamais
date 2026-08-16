"use client"

import type { FornecedorDashboardData } from "@/actions/dashboard"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { MiniChart } from "@/components/dashboard/MiniChart"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowRight, Briefcase, TrendingUp } from "lucide-react"
import Link from "next/link"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

interface Props {
  data: FornecedorDashboardData
}

export function FornecedorDashboardContent({ data }: Props) {
  const greeting = getGreeting()

  function getStatusBadge(status: string): {
    variant: "warning" | "aceita" | "recusada"
    label: string
  } {
    if (status === "aceita") return { variant: "aceita", label: "🟢 Aceita" }
    if (status === "recusada") return { variant: "recusada", label: "🔴 Recusada" }
    return { variant: "warning", label: "🟡 Pendente" }
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
            {data.cotacoesDisponiveis > 0 ? (
              <>
                Existem{" "}
                <span className="text-primary-400 font-bold">
                  {data.cotacoesDisponiveis} cotaç{data.cotacoesDisponiveis === 1 ? "ão" : "ões"}
                </span>{" "}
                aguardando sua proposta
              </>
            ) : (
              "Encontre novas oportunidades e gerencie seus orçamentos."
            )}
          </p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="animate-slide-up rounded-2xl border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-800 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Resumo da Proposta</h2>
            <p className="text-sm text-neutral-400">
              Acompanhe rapidamente o status das suas propostas
            </p>
          </div>
          <Link href="/fornecedor/propostas">
            <Button
              variant="secondary"
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-200 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white dark:border-white/10 cursor-pointer transition-all duration-300"
            >
              Ver todas
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="warning" dot>
            🟡 Pendente: {data.propostasStatusCounts.pendente}
          </Badge>
          <Badge variant="aceita" dot>
            🟢 Aceita: {data.propostasStatusCounts.aceita}
          </Badge>
          <Badge variant="recusada" dot>
            🔴 Recusada: {data.propostasStatusCounts.recusada}
          </Badge>
        </div>

        {data.propostasResumo.length === 0 ? (
          <div className="mt-6 text-sm text-neutral-400">
            Nenhuma proposta enviada ainda.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-6 hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200 dark:border-white/[0.06]">
                    <th className="py-2 pr-4 font-semibold">Cotação</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 pr-4 font-semibold text-right">Total</th>
                    <th className="py-2 font-semibold text-right">Enviada em</th>
                  </tr>
                </thead>
                <tbody>
                  {data.propostasResumo.map((p) => {
                    const badge = getStatusBadge(p.status)
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-neutral-200 dark:border-white/[0.04] last:border-b-0"
                      >
                        <td className="py-3 pr-4 text-neutral-900 dark:text-neutral-200 font-semibold">
                          {p.cotacao_titulo ?? "Cotação"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={badge.variant} dot>
                            {badge.label}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right text-neutral-900 dark:text-neutral-200 font-bold">
                          {p.valor_total ? formatCurrency(p.valor_total) : "—"}
                        </td>
                        <td className="py-3 text-right text-neutral-500 font-medium">
                          {formatDate(p.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mt-6 grid gap-3 md:hidden">
              {data.propostasResumo.map((p) => {
                const badge = getStatusBadge(p.status)
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-neutral-200 dark:border-white/[0.06] bg-neutral-50 dark:bg-white/[0.02] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-200 truncate">
                          {p.cotacao_titulo ?? "Cotação"}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          Enviada em {formatDate(p.created_at)}
                        </p>
                      </div>
                      <Badge variant={badge.variant} dot>
                        {badge.label}
                      </Badge>
                    </div>

                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-xs text-neutral-500 font-medium">Valor total</p>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white">
                        {p.valor_total ? formatCurrency(p.valor_total) : "—"}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {data.stats.map((stat, index) => (
          <DashboardCard key={stat.label} {...stat} delay={index} />
        ))}
      </div>

      {/* ── Chart + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Chart */}
        <div className="lg:col-span-3 animate-slide-up-delay-3 rounded-2xl border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-800 p-6">
          <MiniChart
            data={data.chartData}
            label="Propostas — Últimos 7 dias"
            color="#6366F1"
          />
        </div>

        {/* Activity */}
        <div className="lg:col-span-2 animate-slide-up-delay-4 rounded-2xl border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-800 p-6">
          <h3 className="text-sm font-semibold text-neutral-300 mb-4">
            Atividades Recentes
          </h3>
          <RecentActivity items={data.recentActivity} />
        </div>
      </div>

      {/* ── Opportunities + Performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up-delay-4">
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-white dark:from-neutral-900 dark:to-neutral-900 border border-neutral-200 dark:border-white/[0.06] p-8 min-h-[260px] flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-8 opacity-[0.06] scale-125">
            <Briefcase className="h-48 w-48 text-primary-400" />
          </div>
          <div className="relative z-10 space-y-4">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Novas Oportunidades
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm max-w-md">
              Existem {data.cotacoesDisponiveis || 0} cotações abertas
              aguardando propostas. Não perca tempo e envie sua melhor oferta
              agora mesmo.
            </p>
          </div>
          <div className="relative z-10 pt-6">
            <Link href="/fornecedor/cotacoes">
              <Button
                variant="secondary"
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-200 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white dark:border-white/10 cursor-pointer transition-all duration-300 px-8"
              >
                Ver Oportunidades
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-primary-500/10 bg-primary-500/[0.04] p-8 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="h-12 w-12 bg-white dark:bg-neutral-800 rounded-xl shadow-sm flex items-center justify-center text-primary-400 border border-neutral-200 dark:border-white/[0.06]">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Desempenho</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Acompanhe a taxa de aceitação de suas propostas para otimizar seus
              preços.
            </p>
          </div>
          <Link
            href="/fornecedor/propostas"
            className="pt-6 text-sm font-bold text-primary-400 flex items-center gap-2 hover:gap-3 transition-all"
          >
            Minhas Propostas
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
