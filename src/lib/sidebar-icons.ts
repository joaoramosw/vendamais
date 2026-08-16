import {
  Archive,
  BarChart3,
  Bell,
  Bookmark,
  Box,
  Boxes,
  Building2,
  Calendar,
  ClipboardList,
  Compass,
  CreditCard,
  Database,
  FileText,
  Flag,
  Folder,
  FolderOpen,
  Heart,
  Home,
  Key,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  List,
  Lock,
  Mail,
  MessageCircle,
  Package,
  Palette,
  PieChart,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Tags,
  Target,
  TrendingUp,
  Trophy,
  Truck,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { createElement } from "react";

export type SidebarIconComponent = React.ComponentType<{ className?: string }>;

/**
 * Ícones oferecidos no seletor de "Editar Layout" e usados pra resolver o
 * nome salvo no layout (localStorage guarda só a string). Manter os nomes
 * iguais aos do lucide facilita adicionar novos — é só importar acima.
 */
export const SIDEBAR_ICONS: Record<string, SidebarIconComponent> = {
  LayoutGrid,
  LayoutDashboard,
  Folder,
  FolderOpen,
  Package,
  Boxes,
  Box,
  Archive,
  Tags,
  Layers,
  List,
  ClipboardList,
  FileText,
  Trophy,
  Target,
  Flag,
  Star,
  Sparkles,
  Heart,
  Bookmark,
  ShoppingCart,
  ShoppingBag,
  Store,
  Truck,
  Building2,
  Users,
  ShieldCheck,
  Key,
  Lock,
  Settings,
  SlidersHorizontal,
  Wrench,
  Palette,
  Wallet,
  CreditCard,
  BarChart3,
  PieChart,
  TrendingUp,
  Database,
  Bell,
  Calendar,
  Mail,
  MessageCircle,
  Search,
  Compass,
  Home,
  Zap,
};

export const SIDEBAR_ICON_NAMES = Object.keys(SIDEBAR_ICONS);

export const FALLBACK_SIDEBAR_ICON = "Folder";

export function resolveSidebarIcon(name: string | undefined | null): SidebarIconComponent {
  return (name && SIDEBAR_ICONS[name]) || SIDEBAR_ICONS[FALLBACK_SIDEBAR_ICON];
}

/**
 * Devolve o elemento já pronto, em vez do componente. Ligar o componente a uma
 * variável local dentro do render (`const Icon = ...; <Icon />`) faz o React
 * Compiler acusar "component created during render" — aqui o elemento é criado
 * fora do corpo de qualquer componente.
 */
export function renderSidebarIcon(
  name: string | undefined | null,
  className = "h-4 w-4",
): React.ReactElement {
  return createElement(resolveSidebarIcon(name), { className });
}
