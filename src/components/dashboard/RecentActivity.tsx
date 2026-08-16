"use client"

import type { ActivityItem } from "@/actions/dashboard"
import { formatRelativeDate } from "@/lib/utils"
import {
    ArrowRight,
    CheckCircle2,
    FileText,
    Inbox,
    Send,
    XCircle
} from "lucide-react"
import Link from "next/link"

const activityConfig: Record<
  ActivityItem["type"],
  { icon: typeof FileText; color: string; dotColor: string }
> = {
  cotacao_criada: {
    icon: FileText,
    color: "text-primary-400",
    dotColor: "bg-primary-500",
  },
  proposta_recebida: {
    icon: Inbox,
    color: "text-sky-400",
    dotColor: "bg-sky-500",
  },
  cotacao_encerrada: {
    icon: XCircle,
    color: "text-warning-400",
    dotColor: "bg-warning-500",
  },
  proposta_enviada: {
    icon: Send,
    color: "text-sky-400",
    dotColor: "bg-sky-500",
  },
  proposta_aceita: {
    icon: CheckCircle2,
    color: "text-success-400",
    dotColor: "bg-success-500",
  },
}

interface RecentActivityProps {
  items: ActivityItem[]
}

export function RecentActivity({ items }: RecentActivityProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-white/[0.04] flex items-center justify-center mb-3">
          <Inbox className="h-6 w-6 text-neutral-500" />
        </div>
        <p className="text-sm text-neutral-400">Nenhuma atividade recente</p>
        <p className="text-xs text-neutral-500 mt-1">
          Suas ações aparecerão aqui
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const config = activityConfig[item.type]
        const Icon = config.icon

        return (
          <Link
            href="/empresario/cotacoes"
            key={item.id}
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/[0.04] border border-transparent hover:border-neutral-200 dark:hover:border-white/[0.06] transition-all duration-200"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="relative mt-0.5 shrink-0">
                <div
                  className={`h-10 w-10 rounded-full bg-neutral-100 dark:bg-white/[0.04] flex items-center justify-center ${config.color} group-hover:scale-110 transition-transform`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${config.dotColor} ring-2 ring-white dark:ring-neutral-800`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-200 dark:group-hover:text-white transition-colors">
                  {item.title}
                </p>
                <p className="text-xs text-neutral-500 mt-1 line-clamp-2 md:line-clamp-1">
                  {item.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1 pl-12 sm:pl-0 shrink-0">
              <span className="text-[11px] font-medium text-neutral-500">
                {formatRelativeDate(item.created_at)}
              </span>
              <ArrowRight className="h-4 w-4 text-neutral-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 hidden sm:block" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
