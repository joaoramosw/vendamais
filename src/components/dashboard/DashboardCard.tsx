"use client"

import { cn } from "@/lib/utils"
import {
    FileText,
    Search,
    Send,
    TrendingUp,
    type LucideIcon,
} from "lucide-react"
import Link from "next/link"

const iconMap: Record<string, LucideIcon> = {
  FileText,
  Search,
  Send,
  TrendingUp,
}

interface DashboardCardProps {
  label: string
  value: number
  href: string
  icon: string
  color: string
  bgColor: string
  delay?: number
}

export function DashboardCard({
  label,
  value,
  href,
  icon,
  color,
  bgColor,
  delay = 0,
}: DashboardCardProps) {
  const Icon = iconMap[icon] || FileText
  const delayClass = [
    "animate-slide-up",
    "animate-slide-up-delay-1",
    "animate-slide-up-delay-2",
    "animate-slide-up-delay-3",
  ][delay] || "animate-slide-up"

  return (
    <Link href={href} className={cn("block group", delayClass)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-6",
          "bg-white dark:bg-neutral-800 hover:bg-white dark:hover:bg-neutral-800",
          "cursor-pointer transition-all duration-300",
          "hover:scale-[1.03] hover:shadow-lg hover:shadow-primary-500/10",
          "hover:border-primary-500/30"
        )}
      >
        {/* Subtle glow on hover */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-primary-500/5 via-transparent to-transparent" />

        <div className="relative z-10 flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              bgColor,
              color,
              "transition-transform duration-300 group-hover:scale-110"
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-3xl font-black text-neutral-900 dark:text-white leading-none mb-1 tabular-nums">
              {value}
            </p>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              {label}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
