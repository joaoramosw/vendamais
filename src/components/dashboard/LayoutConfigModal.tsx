"use client";

import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import {
    DEFAULT_SIDEBAR_LAYOUT,
    dashboardModules,
    defaultModules,
    getStoredLayout,
    getStoredSidebarLayout,
    saveSidebarLayout,
    saveStoredLayout,
    type SidebarEntry,
    type SidebarLayout,
} from "@/lib/hooks/useLayoutConfig";
import { renderSidebarIcon, SIDEBAR_ICON_NAMES } from "@/lib/sidebar-icons";
import {
    closestCorners,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, FolderPlus, GripVertical, X } from "lucide-react";
import { useEffect, useState } from "react";

const GROUP_PREFIX = "grp:";
/** Área de soltura do grupo — necessária pra aceitar item em grupo vazio. */
const DROP_PREFIX = "drop:";
const ROOT = "__root__";

const isGroupRow = (id: string) => id.startsWith(GROUP_PREFIX);
const groupIdOf = (rowId: string) => rowId.slice(GROUP_PREFIX.length);

interface GroupMeta {
  label: string;
  icon: string;
}

interface SidebarState {
  /** Nível raiz: ids de módulo solto e `grp:<id>`, na ordem de exibição. */
  rootOrder: string[];
  /** Filhos por grupo. */
  children: Record<string, string[]>;
  meta: Record<string, GroupMeta>;
  /** Ícone escolhido por módulo (sobrescreve o padrão do código). */
  moduleIcons: Record<string, string>;
}

function layoutToState(layout: SidebarLayout): SidebarState {
  const rootOrder: string[] = [];
  const children: Record<string, string[]> = {};
  const meta: Record<string, GroupMeta> = {};

  for (const entry of layout.entries) {
    if (entry.kind === "group") {
      rootOrder.push(GROUP_PREFIX + entry.group.id);
      children[entry.group.id] = [...entry.group.moduleIds];
      meta[entry.group.id] = { label: entry.group.label, icon: entry.group.icon };
    } else {
      rootOrder.push(entry.id);
    }
  }

  return { rootOrder, children, meta, moduleIcons: { ...layout.icons } };
}

function stateToLayout(state: SidebarState): SidebarLayout {
  const entries: SidebarEntry[] = state.rootOrder.map((rowId) => {
    if (!isGroupRow(rowId)) return { kind: "module", id: rowId };
    const id = groupIdOf(rowId);
    return {
      kind: "group",
      group: {
        id,
        label: state.meta[id]?.label ?? "Grupo",
        icon: state.meta[id]?.icon ?? "Folder",
        moduleIds: state.children[id] ?? [],
      },
    };
  });

  return { entries, icons: state.moduleIcons };
}

/** Grade de ícones — aberta logo abaixo da linha que está sendo editada. */
function IconPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1 p-2 rounded-[var(--radius-md)] border border-white/[0.08] bg-neutral-950">
      {SIDEBAR_ICON_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onPick(name)}
          title={name}
          className={`flex items-center justify-center h-8 w-8 rounded-md transition-colors cursor-pointer ${
            name === value
              ? "bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/50"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06]"
          }`}
        >
          {renderSidebarIcon(name)}
        </button>
      ))}
    </div>
  );
}

function ModuleRow({
  id,
  label,
  icon,
  isHidden,
  isSuperAdmin,
  onToggleVisibility,
  pickerOpen,
  onTogglePicker,
  onPickIcon,
}: {
  id: string;
  label: string;
  /** Ausente na aba do dashboard — lá o ícone não é configurável. */
  icon?: string;
  isHidden: boolean;
  isSuperAdmin: boolean;
  onToggleVisibility: (id: string) => void;
  pickerOpen?: boolean;
  onTogglePicker?: () => void;
  onPickIcon?: (name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : 1,
      }}
      className="space-y-1"
    >
      <div
        className={`flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] border transition-colors ${
          isDragging
            ? "border-primary-500/50 bg-primary-500/10 opacity-90 shadow-lg shadow-black/30"
            : isHidden
              ? "border-white/[0.04] bg-neutral-900 opacity-60"
              : "border-white/[0.08] bg-neutral-900 hover:border-primary-500/30 hover:bg-primary-500/5"
        }`}
      >
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 -ml-1">
          <GripVertical className="h-4 w-4 text-neutral-400 pointer-events-none" />
        </div>
        {icon && onTogglePicker && (
          <button
            type="button"
            onClick={onTogglePicker}
            title="Trocar ícone"
            className={`p-1 rounded transition-colors cursor-pointer ${
              pickerOpen
                ? "bg-primary-500/20 text-primary-300"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06]"
            }`}
          >
            {renderSidebarIcon(icon)}
          </button>
        )}
        <span
          className={`text-sm font-medium flex-1 truncate ${
            isHidden ? "text-neutral-500 line-through" : "text-neutral-200"
          }`}
        >
          {label}
        </span>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => onToggleVisibility(id)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isHidden
                ? "text-neutral-600 hover:text-neutral-400 hover:bg-white/5"
                : "text-primary-400 hover:text-primary-300 hover:bg-primary-500/10"
            }`}
            title={isHidden ? "Mostrar módulo" : "Ocultar módulo"}
          >
            {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {pickerOpen && icon && onPickIcon && <IconPicker value={icon} onPick={onPickIcon} />}
    </div>
  );
}

/**
 * Bloco do grupo: o card inteiro é o sortable da raiz (por isso o grupo se
 * move junto com os filhos e pode parar entre dois itens soltos), enquanto os
 * filhos têm o próprio SortableContext e uma área droppable — que é o que faz
 * um grupo vazio ainda aceitar item arrastado.
 */
function GroupBlock({
  rowId,
  meta,
  childIds,
  renderChild,
  onRename,
  onRemove,
  onPickIcon,
  pickerOpen,
  onTogglePicker,
}: {
  rowId: string;
  meta: GroupMeta;
  childIds: string[];
  renderChild: (moduleId: string) => React.ReactNode;
  onRename: (value: string) => void;
  onRemove: () => void;
  onPickIcon: (name: string) => void;
  pickerOpen: boolean;
  onTogglePicker: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rowId,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: DROP_PREFIX + groupIdOf(rowId) });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : 1,
      }}
      className={`rounded-[var(--radius-md)] border transition-colors ${
        isDragging
          ? "border-primary-500/50 bg-primary-500/10 opacity-90 shadow-lg shadow-black/30"
          : "border-primary-500/20 bg-primary-500/[0.05]"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 -ml-1">
          <GripVertical className="h-4 w-4 text-primary-300/70 pointer-events-none" />
        </div>
        <button
          type="button"
          onClick={onTogglePicker}
          title="Trocar ícone do grupo"
          className={`p-1 rounded transition-colors cursor-pointer ${
            pickerOpen
              ? "bg-primary-500/25 text-primary-200"
              : "text-primary-300 hover:bg-primary-500/15"
          }`}
        >
          {renderSidebarIcon(meta.icon)}
        </button>
        <input
          value={meta.label}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Nome do grupo"
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-primary-200 outline-none border-b border-transparent focus:border-primary-400/50 transition-colors"
        />
        <button
          type="button"
          onClick={onRemove}
          title="Remover grupo (os itens voltam soltos)"
          className="p-1 rounded text-neutral-400 hover:text-danger-400 hover:bg-danger-500/10 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {pickerOpen && (
        <div className="px-3 pb-2">
          <IconPicker value={meta.icon} onPick={onPickIcon} />
        </div>
      )}

      <div
        ref={setDropRef}
        className={`pl-6 pr-3 pb-2.5 space-y-1.5 rounded-b-[var(--radius-md)] transition-colors ${
          isOver ? "bg-primary-500/10" : ""
        }`}
      >
        <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
          {childIds.map(renderChild)}
        </SortableContext>
        {childIds.length === 0 && (
          <p className="text-[11px] text-neutral-500 italic py-2 text-center border border-dashed border-white/[0.08] rounded-[var(--radius-md)]">
            Arraste itens para cá
          </p>
        )}
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Ordem inicial dos cards do dashboard. Omitido, o modal lê a salva. */
  initialOrder?: string[];
  /** Aba aberta ao montar — o botão da sidebar entra direto em "Menu lateral". */
  initialTab?: "dashboard" | "sidebar";
  isSuperAdmin?: boolean;
  isModuleHidden?: (id: string) => boolean;
  onToggleVisibility?: (id: string) => void;
}

export function LayoutConfigModal({
  open,
  onClose,
  initialOrder,
  initialTab = "sidebar",
  isSuperAdmin = false,
  isModuleHidden,
  onToggleVisibility,
}: Props) {
  const [tab, setTab] = useState<"dashboard" | "sidebar">(initialTab);
  const [dashOrder, setDashOrder] = useState<string[]>([]);
  const [state, setState] = useState<SidebarState>(() => layoutToState(DEFAULT_SIDEBAR_LAYOUT));
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setPickerFor(null);
    const base = initialOrder ?? getStoredLayout("dashboard");
    setDashOrder(base.filter((id) => dashboardModules.some((m) => m.id === id)));
    setState(layoutToState(getStoredSidebarLayout()));
  }, [open, initialOrder, initialTab]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDashDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDashOrder((items) =>
      arrayMove(items, items.indexOf(active.id as string), items.indexOf(over.id as string))
    );
  };

  /** Em qual lista o item está hoje: a raiz ou um grupo. */
  const containerOf = (itemId: string, s: SidebarState): string | null => {
    if (s.rootOrder.includes(itemId)) return ROOT;
    for (const [gid, ids] of Object.entries(s.children)) {
      if (ids.includes(itemId)) return gid;
    }
    return null;
  };

  const handleSidebarDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    setState((s) => {
      const from = containerOf(activeId, s);
      if (!from) return s;

      // Soltou na área vazia de um grupo?
      const to = overId.startsWith(DROP_PREFIX)
        ? overId.slice(DROP_PREFIX.length)
        : containerOf(overId, s);
      if (!to) return s;

      // Grupo só existe no nível raiz — não entra dentro de outro grupo.
      if (isGroupRow(activeId) && to !== ROOT) return s;

      const listaDe = (c: string) => (c === ROOT ? s.rootOrder : s.children[c] ?? []);

      if (from === to) {
        const lista = listaDe(from);
        const oldIndex = lista.indexOf(activeId);
        const newIndex = lista.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return s;
        const reordenada = arrayMove(lista, oldIndex, newIndex);
        return from === ROOT
          ? { ...s, rootOrder: reordenada }
          : { ...s, children: { ...s.children, [from]: reordenada } };
      }

      const origem = listaDe(from).filter((id) => id !== activeId);
      const destino = [...listaDe(to)];
      const alvo = destino.indexOf(overId);
      destino.splice(alvo === -1 ? destino.length : alvo, 0, activeId);

      const next = { ...s, children: { ...s.children } };
      if (from === ROOT) next.rootOrder = origem;
      else next.children[from] = origem;
      if (to === ROOT) next.rootOrder = destino;
      else next.children[to] = destino;

      return next;
    });
  };

  /** Remove só o grupo — os itens voltam soltos na posição dele, nunca somem. */
  const removeGroup = (rowId: string) => {
    const gid = groupIdOf(rowId);
    setState((s) => {
      const pos = s.rootOrder.indexOf(rowId);
      const filhos = s.children[gid] ?? [];
      const rootOrder = [...s.rootOrder];
      rootOrder.splice(pos === -1 ? rootOrder.length : pos, 1, ...filhos);

      const children = { ...s.children };
      delete children[gid];
      const meta = { ...s.meta };
      delete meta[gid];

      return { ...s, rootOrder, children, meta };
    });
    setPickerFor(null);
  };

  const addGroup = () => {
    const id = `grupo-${Date.now().toString(36)}`;
    setState((s) => ({
      ...s,
      rootOrder: [...s.rootOrder, GROUP_PREFIX + id],
      children: { ...s.children, [id]: [] },
      meta: { ...s.meta, [id]: { label: "Novo grupo", icon: "Folder" } },
    }));
  };

  const handleSave = () => {
    saveStoredLayout("dashboard", dashOrder);
    saveSidebarLayout(stateToLayout(state));
    onClose();
  };

  const handleReset = () => {
    if (tab === "dashboard") {
      setDashOrder(dashboardModules.map((m) => m.id));
      return;
    }
    setState(layoutToState(DEFAULT_SIDEBAR_LAYOUT));
    setPickerFor(null);
  };

  const togglePicker = (key: string) => setPickerFor((atual) => (atual === key ? null : key));

  const renderModule = (moduleId: string) => {
    const mod = defaultModules.find((m) => m.id === moduleId);
    if (!mod) return null;
    return (
      <ModuleRow
        key={moduleId}
        id={moduleId}
        label={mod.label}
        icon={state.moduleIcons[moduleId] ?? mod.icon}
        isHidden={isModuleHidden ? isModuleHidden(moduleId) : false}
        isSuperAdmin={isSuperAdmin}
        onToggleVisibility={onToggleVisibility ?? (() => {})}
        pickerOpen={pickerFor === moduleId}
        onTogglePicker={() => togglePicker(moduleId)}
        onPickIcon={(name) => {
          setState((s) => ({ ...s, moduleIcons: { ...s.moduleIcons, [moduleId]: name } }));
          setPickerFor(null);
        }}
      />
    );
  };

  const tabButton = (value: "dashboard" | "sidebar", label: string) => (
    <button
      onClick={() => setTab(value)}
      className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all cursor-pointer ${
        tab === value ? "bg-primary-600 text-white shadow" : "text-neutral-400 hover:text-neutral-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <ModalHeader onClose={onClose}>Editar Layout do Painel</ModalHeader>
      <ModalBody className="space-y-4 max-h-[65vh] overflow-y-auto">
        <div className="flex bg-neutral-900 p-1 rounded-lg border border-white/[0.06]">
          {tabButton("sidebar", "Menu lateral")}
          {tabButton("dashboard", "Dashboard")}
        </div>

        <p className="text-xs text-neutral-400">
          {tab === "sidebar" ? (
            <>
              Arraste itens e grupos livremente — um grupo pode ficar entre dois itens soltos.
              Solte um item <strong>dentro</strong> de um grupo para agrupá-lo. Clique no ícone
              para trocá-lo. Remover um grupo devolve os itens soltos, no lugar dele — nenhuma
              seção é excluída.
            </>
          ) : (
            <>Arraste e solte para reordenar os cards do dashboard.</>
          )}
          {isSuperAdmin && (
            <>
              {" "}
              Use o ícone <Eye className="inline h-3 w-3 text-primary-400 mx-0.5" /> para ocultar ou
              mostrar módulos para todos os usuários.
            </>
          )}
        </p>

        {tab === "dashboard" ? (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDashDragEnd}>
            <SortableContext items={dashOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {dashOrder.map((id) => {
                  const mod = dashboardModules.find((m) => m.id === id);
                  if (!mod) return null;
                  return (
                    <ModuleRow
                      key={id}
                      id={id}
                      label={mod.label}
                      isHidden={isModuleHidden ? isModuleHidden(id) : false}
                      isSuperAdmin={isSuperAdmin}
                      onToggleVisibility={onToggleVisibility ?? (() => {})}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragEnd={handleSidebarDragEnd}
            >
              <SortableContext items={state.rootOrder} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {state.rootOrder.map((rowId) => {
                    if (!isGroupRow(rowId)) return renderModule(rowId);

                    const gid = groupIdOf(rowId);
                    const meta = state.meta[gid] ?? { label: "Grupo", icon: "Folder" };
                    return (
                      <GroupBlock
                        key={rowId}
                        rowId={rowId}
                        meta={meta}
                        childIds={state.children[gid] ?? []}
                        renderChild={renderModule}
                        pickerOpen={pickerFor === rowId}
                        onTogglePicker={() => togglePicker(rowId)}
                        onRename={(value) =>
                          setState((s) => ({
                            ...s,
                            meta: { ...s.meta, [gid]: { ...meta, label: value } },
                          }))
                        }
                        onPickIcon={(name) => {
                          setState((s) => ({
                            ...s,
                            meta: { ...s.meta, [gid]: { ...meta, icon: name } },
                          }));
                          setPickerFor(null);
                        }}
                        onRemove={() => removeGroup(rowId)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            <Button variant="secondary" size="sm" type="button" onClick={addGroup}>
              <FolderPlus className="h-4 w-4" />
              Novo grupo
            </Button>
          </>
        )}
      </ModalBody>
      <ModalFooter className="justify-between">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Restaurar original
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar Layout</Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
