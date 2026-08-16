"use client"

import { signOut } from "@/actions/auth"
import { Logo } from "@/components/brand/logo"
import { LayoutConfigModal } from "@/components/dashboard/LayoutConfigModal"
import {
  useCotacoesAbertasComPropostas,
  useCotacoesAtivasFornecedor,
} from "@/lib/hooks/useCotacoesBadgeCount"
import { useDraftList } from "@/lib/hooks/useDraftList"
import { resolveSidebarNodes, useLayoutConfig } from "@/lib/hooks/useLayoutConfig"
import { renderSidebarIcon, resolveSidebarIcon } from "@/lib/sidebar-icons"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Send,
  Settings,
  SlidersHorizontal,
  Tags,
  Trophy,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarLink {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  hasBadge?: boolean
  /** "success-pulse" usa um selo verde com halo pulsante (chamada mais forte
   * pro fornecedor: "tem cotação aberta esperando resposta"). */
  badgeVariant?: "default" | "success-pulse"
}

interface SidebarProps {
  userRole: "admin" | "supplier"
  userName: string
  canManageUsers?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Static link definitions
// ─────────────────────────────────────────────────────────────────────────────

const empresarioLinks: SidebarLink[] = [
  { label: "Dashboard", href: "/empresario/dashboard", icon: LayoutDashboard },
  { label: "Produtos", href: "/empresario/produtos", icon: Package },
  { label: "Lista de Cotação", href: "/empresario/lista-cotacao", icon: ClipboardList, hasBadge: true },
  { label: "Minhas Cotações", href: "/empresario/cotacoes", icon: FileText, hasBadge: true },
  { label: "Categorias", href: "/empresario/categorias", icon: Tags },
  { label: "Segmentos", href: "/empresario/segmentos", icon: Layers },
  { label: "Ranking", href: "/empresario/ranking", icon: Trophy },
]

/**
 * Menu do fornecedor. **Sem "Dashboard"**: a tela está desativada (ver
 * `FORNECEDOR_DASHBOARD_HABILITADO` em src/lib/routes.ts — o código continua no
 * repositório) e "Cotações Ativas" virou a landing do papel, por isso é o
 * primeiro item.
 */
const fornecedorLinks: SidebarLink[] = [
  { label: "Cotações Ativas", href: "/fornecedor/cotacoes", icon: FileText, hasBadge: true, badgeVariant: "success-pulse" },
  { label: "Minhas Propostas", href: "/fornecedor/propostas", icon: Send },
  { label: "Configurações", href: "/fornecedor/configuracoes", icon: Settings },
]

/** Grupos fechados — persistido para o menu abrir do jeito que o usuário deixou. */
const COLLAPSED_GROUPS_KEY = "vendamais:layout:sidebar:grupos-fechados"

function loadCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY)
    return raw ? new Set<string>(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge — encapsula sua própria animação de entrada/saída, independente por
// link (cada instância rastreia o valor anterior via ref).
// ─────────────────────────────────────────────────────────────────────────────

function SidebarBadge({
  count,
  variant = "default",
  collapsed,
}: {
  count: number
  variant?: "default" | "success-pulse"
  collapsed: boolean
}) {
  const prevCount = useRef(count)
  const [animKey, setAnimKey] = useState(0)
  const [anim, setAnim] = useState("")

  useEffect(() => {
    if (count > prevCount.current) {
      setAnim("animate-badge-slide-up")
      setAnimKey((k) => k + 1)
    } else if (count < prevCount.current) {
      setAnim("animate-badge-slide-down")
      setAnimKey((k) => k + 1)
    }
    prevCount.current = count
  }, [count])

  if (count <= 0) return null

  const isPulse = variant === "success-pulse"

  return (
    <span
      key={animKey}
      className={cn(
        "relative flex items-center justify-center rounded-full font-bold",
        collapsed
          ? "absolute -top-0.5 -right-0.5 min-w-[16px] h-4 text-[9px] px-1"
          : "ml-auto min-w-[20px] h-5 text-[10px] px-1.5",
        isPulse ? "bg-success-500 text-white" : "bg-primary-500 text-white",
        anim
      )}
    >
      {isPulse && (
        <span className="absolute inset-0 rounded-full bg-success-400 animate-ping opacity-75" />
      )}
      <span className="relative">{count}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar({ userRole, userName, canManageUsers }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { count: draftCount } = useDraftList()
  const cotacoesComPropostasCount = useCotacoesAbertasComPropostas(userRole === "admin")
  const cotacoesAtivasCount = useCotacoesAtivasFornecedor(userRole === "supplier")

  const badgeCounts: Record<string, number> = {
    "/empresario/lista-cotacao": draftCount,
    "/empresario/cotacoes": cotacoesComPropostasCount,
    "/fornecedor/cotacoes": cotacoesAtivasCount,
  }

  // Layout config (empresário) — ordenação, visibilidade e agrupamento
  const { sidebarLayout, hiddenSet, mounted, isModuleHidden, toggleModuleVisibility } =
    useLayoutConfig('sidebar')

  const [layoutModalOpen, setLayoutModalOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  useEffect(() => {
    setCollapsedGroups(loadCollapsedGroups())
  }, [])

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      try {
        localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...next]))
      } catch {
        // Sem localStorage (Safari privado) o estado só não persiste entre sessões.
      }
      return next
    })
  }, [])

  // Dashboard fica sempre no topo, fora dos módulos configuráveis.
  const dashboardLink = empresarioLinks[0]

  const nodes = resolveSidebarNodes(sidebarLayout, {
    hidden: hiddenSet,
    canManageUsers: !!canManageUsers,
  })

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const renderLink = (item: SidebarLink, opts?: { nested?: boolean }) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

    // Lista de Cotação sem nenhum item fica apagada: é um rascunho vazio, não
    // há nada pra revisar ali. Mesmo sinal que o badge já dá (ele some no
    // zero) — a cor só reforça, e volta ao normal no hover e quando a tela
    // está aberta.
    const vazio =
      item.href === "/empresario/lista-cotacao" && (badgeCounts[item.href] ?? 0) === 0

    const link = (
      <Link
        key={collapsed ? undefined : item.href}
        href={item.href}
        id={item.href === "/empresario/lista-cotacao" ? "sidebar-draft-icon" : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={cn(
          "flex items-center px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-all duration-300",
          collapsed ? "justify-center px-0 gap-0" : "gap-3",
          !collapsed && opts?.nested && "pl-9",
          isActive
            ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
            : vazio
            ? "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-600 dark:hover:text-neutral-200 dark:hover:bg-white/[0.04]"
            : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-white/[0.04]",
        )}
      >
        <div className="relative shrink-0">
          <item.icon className="h-5 w-5" />
          {collapsed && item.hasBadge && (
            <SidebarBadge
              count={badgeCounts[item.href] ?? 0}
              variant={item.badgeVariant}
              collapsed
            />
          )}
        </div>
        <span
          className="flex-1 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out"
          style={{ maxWidth: collapsed ? 0 : 200, opacity: collapsed ? 0 : 1 }}
        >
          {item.label}
        </span>
        {!collapsed && item.hasBadge && (
          <SidebarBadge
            count={badgeCounts[item.href] ?? 0}
            variant={item.badgeVariant}
            collapsed={false}
          />
        )}
      </Link>
    )

    // Recolhida, o rótulo do link some — o tooltip é a única pista de pra
    // onde ele leva. Aberta, o texto já está ali do lado do ícone, sem
    // wrapper extra (preserva o DOM original pro `space-y-1` do nav).
    if (!collapsed) return link

    return (
      <Tooltip key={item.href} label={item.label} side="right" className="w-full">
        {link}
      </Tooltip>
    )
  }

  /** Módulo do layout → link da sidebar, reaproveitando o badge do link
   * estático e respeitando o ícone escolhido em "Editar Layout". */
  const toLink = (mod: { label: string; href: string }, icon: string): SidebarLink => {
    const staticLink = empresarioLinks.find((l) => l.href === mod.href)
    return {
      label: mod.label,
      href: mod.href,
      icon: resolveSidebarIcon(icon),
      hasBadge: staticLink?.hasBadge,
      badgeVariant: staticLink?.badgeVariant,
    }
  }

  const empresarioNav = (
    <>
      {renderLink(dashboardLink)}
      {/* Antes de montar não dá pra ler o layout salvo (localStorage) — cai na
          lista plana pra não piscar uma navegação diferente da configurada. */}
      {!mounted
        ? empresarioLinks.slice(1).map((item) => renderLink(item))
        : nodes.map((node) => {
            if (node.kind === "module") return renderLink(toLink(node.module, node.icon))

            // Recolhida (72px) não há espaço pro cabeçalho do grupo — os itens
            // viram ícones soltos, mantendo tudo alcançável em um clique.
            if (collapsed) {
              return (
                <Fragment key={node.group.id}>
                  {node.modules.map((m) => renderLink(toLink(m.module, m.icon)))}
                </Fragment>
              )
            }

            const isOpen = !collapsedGroups.has(node.group.id)
            const hasActiveChild = node.modules.some(
              ({ module: m }) => pathname === m.href || pathname.startsWith(m.href + "/"),
            )

            return (
              <div key={node.group.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(node.group.id)}
                  aria-expanded={isOpen}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-semibold transition-colors cursor-pointer",
                    hasActiveChild && !isOpen
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.04] hover:text-neutral-900 dark:hover:text-neutral-200",
                  )}
                >
                  {renderSidebarIcon(node.group.icon, "h-5 w-5 shrink-0")}
                  <span className="flex-1 text-left truncate">{node.group.label}</span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                </button>
                {isOpen && (
                  <div className="space-y-1">
                    {node.modules.map((m) =>
                      renderLink(toLink(m.module, m.icon), { nested: true }),
                    )}
                  </div>
                )}
              </div>
            )
          })}
    </>
  )

  const sidebarContent = (
    <>
      {/* Marca — recolhida (72px) só o símbolo; aberta, o lockup por extenso. */}
      <div
        className={cn(
          "flex items-center h-16 border-b border-neutral-200 dark:border-white/[0.06] shrink-0 overflow-hidden transition-all duration-300",
          collapsed ? "justify-center px-0" : "px-5",
        )}
      >
        {collapsed ? (
          // App icon puro: em 72px não cabe texto nenhum ao lado, e o `mark`
          // padrão ainda escreveria "Venda Mais" — o overflow escondia o nome
          // e empurrava o símbolo pra fora do centro.
          <Logo variant="icon" size="md" priority />
        ) : (
          <div className="flex flex-col justify-center min-w-0 animate-fade-in">
            <Logo variant="full" size="md" priority />
            <p className="text-[10px] text-neutral-500 mt-1 whitespace-nowrap">
              {userRole === "admin"
                ? "Painel do Administrador"
                : "Painel do Fornecedor"}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 ">
        {userRole === "admin"
          ? empresarioNav
          : fornecedorLinks.map((item) => renderLink(item))}
      </nav>

      {/* Spacer to push footer to bottom */}
      <div className="flex-1" />

      {/* User info + actions */}
      <div className="px-3 py-4 border-t border-neutral-200 dark:border-white/[0.06] shrink-0">
        <div className={cn(
          "flex items-center",
          collapsed ? "flex-col gap-4" : "justify-between gap-1"
        )}>
          {/* User Info */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold shrink-0">
              {userName?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <span
              className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate pr-1 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out"
              style={{ maxWidth: collapsed ? 0 : 120, opacity: collapsed ? 0 : 1 }}
            >
              {userName?.split(' ')?.[0] || 'Usuário'}
            </span>
          </div>

          {/* Actions — tooltip descritivo sempre presente (não só recolhida):
              ícone sozinho não entrega o que cada um faz. Recolhida, os
              ícones empilham (`flex-col`) e o balão vai pra direita; aberta,
              ficam em linha e o balão sobe (há espaço de sobra acima, o
              rodapé fica no fim da tela). */}
          <div className={cn(
            "flex items-center shrink-0",
            collapsed ? "flex-col gap-4" : "gap-1"
          )}>
            {userRole === "admin" && (
              <Tooltip label="Organizar menu" side={collapsed ? "right" : "top"}>
                <button
                  onClick={() => setLayoutModalOpen(true)}
                  aria-label="Organizar menu"
                  className="p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:text-neutral-300 dark:hover:bg-white/[0.04] rounded-[var(--radius-md)] transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </Tooltip>
            )}

            {/* Envolve com um `div` só pra esconder no mobile — evita empilhar
                "hidden" com o "inline-flex" fixo do Tooltip na mesma classe. */}
            <div className="hidden lg:block">
              <Tooltip label={collapsed ? "Expandir menu" : "Recolher menu"} side={collapsed ? "right" : "top"}>
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                  className="p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:text-neutral-300 dark:hover:bg-white/[0.04] rounded-[var(--radius-md)] transition-colors cursor-pointer"
                >
                  <ChevronLeft
                    className="h-4 w-4 transition-transform duration-300 ease-in-out"
                    style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>
              </Tooltip>
            </div>

            <Tooltip label="Sair" side={collapsed ? "right" : "top"}>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Sair"
                  className="p-1.5 text-neutral-500 hover:text-danger-400 hover:bg-danger-500/10 rounded-[var(--radius-md)] transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </Tooltip>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-3 bg-white dark:bg-neutral-800 rounded-[var(--radius-md)] shadow-md border border-neutral-200 dark:border-white/[0.06]"
      >
        {mobileOpen ? (
          <X className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
        ) : (
          <Menu className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 dark:bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-white/[0.06] transition-all duration-300 ease-in-out shrink-0",
          collapsed ? "w-[72px]" : "w-[240px]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 h-full w-[260px] bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-white/[0.06] flex flex-col z-40 transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {userRole === "admin" && (
        <LayoutConfigModal
          open={layoutModalOpen}
          onClose={() => setLayoutModalOpen(false)}
          initialTab="sidebar"
          isModuleHidden={isModuleHidden}
          onToggleVisibility={toggleModuleVisibility}
        />
      )}
    </>
  )
}
