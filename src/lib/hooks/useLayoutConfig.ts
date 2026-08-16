import { useCallback, useEffect, useState } from 'react';

export type LayoutScope = 'dashboard' | 'sidebar' | 'both';

export interface LayoutModule {
  id: string;
  label: string;
  icon: string;
  href: string;
  /** If true, this module is hidden by default until a super_admin enables it. */
  defaultHidden?: boolean;
  /** Item de navegação apenas — não vira card do dashboard. */
  sidebarOnly?: boolean;
  /** Só aparece para quem pode gerenciar usuários. */
  requiresManageUsers?: boolean;
}

export const defaultModules: LayoutModule[] = [
  { id: 'produtos', label: 'Produtos', icon: 'Package', href: '/empresario/produtos' },
  { id: 'categorias', label: 'Categorias', icon: 'Tags', href: '/empresario/categorias' },
  { id: 'segmentos', label: 'Segmentos', icon: 'Layers', href: '/empresario/segmentos' },
  { id: 'lista-cotacao', label: 'Lista de Cotação', icon: 'ClipboardList', href: '/empresario/lista-cotacao' },
  { id: 'cotacoes', label: 'Minhas Cotações', icon: 'FileText', href: '/empresario/cotacoes' },
  { id: 'ranking', label: 'Ranking', icon: 'Trophy', href: '/empresario/ranking', defaultHidden: true },
  {
    id: 'usuarios',
    label: 'Usuários',
    icon: 'ShieldCheck',
    href: '/empresario/usuarios',
    sidebarOnly: true,
    requiresManageUsers: true,
  },
  { id: 'aparencia', label: 'Aparência', icon: 'Palette', href: '/empresario/aparencia', sidebarOnly: true },
  {
    id: 'ajustes',
    // Rótulo "Markup" (o id continua 'ajustes' — trocá-lo derrubaria o layout
    // já salvo em localStorage de quem usa o sistema).
    label: 'Markup',
    icon: 'SlidersHorizontal',
    href: '/empresario/ajustes',
    sidebarOnly: true,
  },
];

/** Módulos que viram card no dashboard (os `sidebarOnly` ficam de fora). */
export const dashboardModules = defaultModules.filter((m) => !m.sidebarOnly);

const STORAGE_KEY_DASHBOARD = 'vendamais:layout:dashboard';
const STORAGE_KEY_SIDEBAR = 'vendamais:layout:sidebar';
const STORAGE_KEY_HIDDEN = 'vendamais:layout:hidden';
/** v2 = grupos, mas com os itens soltos presos acima deles. */
const STORAGE_KEY_SIDEBAR_V2 = 'vendamais:layout:sidebar:v2';
/** v3 = ordem livre — grupo e item solto convivem na mesma lista raiz. */
const STORAGE_KEY_SIDEBAR_V3 = 'vendamais:layout:sidebar:v3';

// ─────────────────────────────────────────────────────────────────────────────
// Grupos da sidebar
// ─────────────────────────────────────────────────────────────────────────────

export interface LayoutGroup {
  id: string;
  label: string;
  /** Nome do ícone (ver src/lib/sidebar-icons.ts). */
  icon: string;
  moduleIds: string[];
}

export type SidebarEntry =
  | { kind: 'module'; id: string }
  | { kind: 'group'; group: LayoutGroup };

/**
 * Estrutura da sidebar: uma única lista raiz onde item solto e grupo convivem
 * em qualquer ordem — dá pra colocar um grupo entre dois itens soltos e
 * vice-versa. `icons` guarda a troca de ícone por módulo (o grupo carrega o
 * dele em `group.icon`).
 */
export interface SidebarLayout {
  entries: SidebarEntry[];
  icons: Record<string, string>;
}

export const DEFAULT_SIDEBAR_LAYOUT: SidebarLayout = {
  entries: [
    { kind: 'module', id: 'lista-cotacao' },
    { kind: 'module', id: 'cotacoes' },
    { kind: 'module', id: 'ranking' },
    {
      kind: 'group',
      group: { id: 'geral', label: 'Geral', icon: 'LayoutGrid', moduleIds: ['produtos', 'categorias'] },
    },
    {
      kind: 'group',
      group: {
        id: 'ajustes',
        label: 'Ajustes',
        icon: 'Settings',
        moduleIds: ['usuarios', 'segmentos', 'aparencia', 'ajustes'],
      },
    },
  ],
  icons: {},
};

export function cloneSidebarLayout(layout: SidebarLayout): SidebarLayout {
  return {
    entries: layout.entries.map((entry) =>
      entry.kind === 'group'
        ? { kind: 'group', group: { ...entry.group, moduleIds: [...entry.group.moduleIds] } }
        : { kind: 'module', id: entry.id },
    ),
    icons: { ...layout.icons },
  };
}

/** Formato v2 (itens soltos presos acima dos grupos), lido só pra migração. */
interface SidebarLayoutV2 {
  root?: string[];
  groups?: LayoutGroup[];
}

function fromV2(v2: SidebarLayoutV2): SidebarLayout {
  return {
    entries: [
      ...(v2.root ?? []).map((id): SidebarEntry => ({ kind: 'module', id })),
      ...(v2.groups ?? []).map((group): SidebarEntry => ({ kind: 'group', group })),
    ],
    icons: {},
  };
}

/**
 * Descarta ids desconhecidos/duplicados e garante que todo módulo conhecido
 * apareça em algum lugar — módulo novo no código entra solto no fim, sem
 * sumir da navegação de quem já tem layout salvo.
 */
export function reconcileSidebarLayout(layout: SidebarLayout): SidebarLayout {
  const known = new Set(defaultModules.map((m) => m.id));
  const seen = new Set<string>();
  const gruposVistos = new Set<string>();

  const take = (ids: string[]) =>
    ids.filter((id) => {
      if (!known.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  const entries: SidebarEntry[] = [];

  for (const entry of layout.entries ?? []) {
    if (!entry) continue;

    if (entry.kind === 'group') {
      const group = entry.group;
      if (!group?.id || gruposVistos.has(group.id)) continue;
      gruposVistos.add(group.id);
      entries.push({
        kind: 'group',
        group: {
          id: group.id,
          label: group.label || 'Grupo',
          icon: group.icon || 'Folder',
          moduleIds: take(group.moduleIds ?? []),
        },
      });
      continue;
    }

    if (take([entry.id]).length > 0) entries.push({ kind: 'module', id: entry.id });
  }

  for (const mod of defaultModules) {
    if (!seen.has(mod.id)) entries.push({ kind: 'module', id: mod.id });
  }

  const icons: Record<string, string> = {};
  for (const [id, name] of Object.entries(layout.icons ?? {})) {
    if (known.has(id) && typeof name === 'string' && name) icons[id] = name;
  }

  return { entries, icons };
}

export function getStoredSidebarLayout(): SidebarLayout {
  if (typeof window === 'undefined') return cloneSidebarLayout(DEFAULT_SIDEBAR_LAYOUT);
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SIDEBAR_V3);
    if (raw) return reconcileSidebarLayout(JSON.parse(raw) as SidebarLayout);

    // Migração do v2 — preserva a arrumação de quem já tinha customizado.
    const legado = localStorage.getItem(STORAGE_KEY_SIDEBAR_V2);
    if (legado) return reconcileSidebarLayout(fromV2(JSON.parse(legado) as SidebarLayoutV2));

    return cloneSidebarLayout(DEFAULT_SIDEBAR_LAYOUT);
  } catch {
    return cloneSidebarLayout(DEFAULT_SIDEBAR_LAYOUT);
  }
}

export function saveSidebarLayout(layout: SidebarLayout) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_SIDEBAR_V3, JSON.stringify(reconcileSidebarLayout(layout)));
  window.dispatchEvent(new Event('layout-changed'));
}

export type SidebarNode =
  | { kind: 'module'; module: LayoutModule; icon: string }
  | { kind: 'group'; group: LayoutGroup; modules: Array<{ module: LayoutModule; icon: string }> };

/**
 * Resolve a estrutura salva nos nós que a sidebar realmente renderiza:
 * módulos ocultos saem, itens restritos saem para quem não tem permissão, e
 * grupo que ficou sem nenhum filho visível some junto.
 */
export function resolveSidebarNodes(
  layout: SidebarLayout,
  opts: { hidden: Set<string>; canManageUsers: boolean },
): SidebarNode[] {
  const visivel = (id: string): { module: LayoutModule; icon: string } | null => {
    const mod = defaultModules.find((m) => m.id === id);
    if (!mod) return null;
    if (opts.hidden.has(mod.id)) return null;
    if (mod.requiresManageUsers && !opts.canManageUsers) return null;
    return { module: mod, icon: layout.icons[mod.id] ?? mod.icon };
  };

  const nodes: SidebarNode[] = [];

  for (const entry of layout.entries) {
    if (entry.kind === 'module') {
      const item = visivel(entry.id);
      if (item) nodes.push({ kind: 'module', ...item });
      continue;
    }

    const modules = entry.group.moduleIds
      .map(visivel)
      .filter((m): m is { module: LayoutModule; icon: string } => !!m);
    if (modules.length > 0) nodes.push({ kind: 'group', group: entry.group, modules });
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hidden modules (super_admin only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the set of module IDs that are currently hidden.
 * On first run, modules with `defaultHidden: true` are hidden.
 */
function getHiddenModules(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set(defaultModules.filter(m => m.defaultHidden).map(m => m.id));
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_HIDDEN);
    if (raw === null) {
      // First run — use defaults
      return new Set(defaultModules.filter(m => m.defaultHidden).map(m => m.id));
    }
    return new Set<string>(JSON.parse(raw));
  } catch {
    return new Set(defaultModules.filter(m => m.defaultHidden).map(m => m.id));
  }
}

function saveHiddenModules(hidden: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify([...hidden]));
  window.dispatchEvent(new Event('layout-changed'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Module ordering
// ─────────────────────────────────────────────────────────────────────────────

export function getStoredLayout(scope: 'dashboard' | 'sidebar'): string[] {
  const base = scope === 'dashboard' ? dashboardModules : defaultModules;
  if (typeof window === 'undefined') return base.map(m => m.id);
  const key = scope === 'dashboard' ? STORAGE_KEY_DASHBOARD : STORAGE_KEY_SIDEBAR;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return base.map(m => m.id);
    const saved: string[] = JSON.parse(raw);

    // Validate saved layout against existing modules
    const validIds = new Set(base.map(m => m.id));
    const filtered = saved.filter(id => validIds.has(id));
    const missing = base.filter(m => !filtered.includes(m.id)).map(m => m.id);

    return [...filtered, ...missing];
  } catch {
    return base.map(m => m.id);
  }
}

export function saveStoredLayout(scope: LayoutScope, order: string[]) {
  if (typeof window === 'undefined') return;

  if (scope === 'dashboard' || scope === 'both') {
    localStorage.setItem(STORAGE_KEY_DASHBOARD, JSON.stringify(order));
  }

  if (scope === 'sidebar' || scope === 'both') {
    localStorage.setItem(STORAGE_KEY_SIDEBAR, JSON.stringify(order));
  }

  // Dispatch a custom event to notify other components to re-render
  window.dispatchEvent(new Event('layout-changed'));
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook
// ─────────────────────────────────────────────────────────────────────────────

export function useLayoutConfig(scope: 'dashboard' | 'sidebar') {
  const [order, setOrder] = useState<string[]>([]);
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(new Set());
  const [sidebarLayout, setSidebarLayout] = useState<SidebarLayout>(() =>
    cloneSidebarLayout(DEFAULT_SIDEBAR_LAYOUT),
  );
  const [mounted, setMounted] = useState(false);

  const loadState = useCallback(() => {
    setOrder(getStoredLayout(scope));
    setHiddenSet(getHiddenModules());
    setSidebarLayout(getStoredSidebarLayout());
  }, [scope]);

  useEffect(() => {
    loadState();
    setMounted(true);

    const handleLayoutChanged = () => {
      loadState();
    };

    window.addEventListener('layout-changed', handleLayoutChanged);
    return () => {
      window.removeEventListener('layout-changed', handleLayoutChanged);
    };
  }, [loadState]);

  const base = scope === 'dashboard' ? dashboardModules : defaultModules;

  /** All modules in configured order (including hidden ones — for the config modal). */
  const allOrderedModules = order
    .map(id => base.find(m => m.id === id))
    .filter(Boolean) as LayoutModule[];

  /** Only visible modules in configured order (for sidebar and dashboard rendering). */
  const orderedModules = allOrderedModules.filter(m => !hiddenSet.has(m.id));

  /** Toggle a module's visibility. Only super_admin should call this. */
  const toggleModuleVisibility = useCallback((moduleId: string) => {
    setHiddenSet(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      saveHiddenModules(next);
      return next;
    });
  }, []);

  /** Check if a module is currently hidden. */
  const isModuleHidden = useCallback((moduleId: string) => {
    return hiddenSet.has(moduleId);
  }, [hiddenSet]);

  return {
    order,
    orderedModules,
    allOrderedModules,
    sidebarLayout,
    hiddenSet,
    mounted,
    isModuleHidden,
    toggleModuleVisibility,
  };
}
