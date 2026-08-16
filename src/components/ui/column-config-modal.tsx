"use client";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
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
import { ChevronDown, GripVertical, Lock, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export interface ColumnDef {
  id: string;
  label: string;
  /** Se true, a coluna fica fixa e não pode ser movida */
  fixed?: boolean;
  /** Se false, a coluna não pode ter o texto renomeado (ex.: coluna de checkbox sem texto) */
  renamable?: boolean;
}

interface UnitOption {
  value: string;
  label: string;
}

export interface FeatureToggleDef {
  id: string;
  label: string;
  description?: string;
}

interface ColumnConfigModalProps {
  open: boolean;
  onClose: () => void;
  columns: ColumnDef[];
  columnOrder: string[];
  onSave: (newOrder: string[]) => void;
  /** Título do modal — vira "Configurações" quando há aba de funcionalidades. */
  title?: string;
  /** Quando informado, o modal ganha a aba "Funcionalidades". */
  featureDefs?: FeatureToggleDef[];
  featureState?: Record<string, boolean>;
  onFeaturesChange?: (next: Record<string, boolean>) => void;
  /** Rótulos customizados atuais (id da coluna -> texto), se houver */
  columnLabels?: Record<string, string>;
  /** Callback para salvar os rótulos customizados */
  onLabelsChange?: (labels: Record<string, string>) => void;
  /** Unidade padrão atual (opcional) */
  defaultUnit?: string;
  /** Callback para alterar a unidade padrão (opcional) */
  onDefaultUnitChange?: (unit: string) => void;
  /** Opções de unidade disponíveis (opcional) */
  unitOptions?: UnitOption[];
}

function ColumnSortableItem({
  id,
  col,
  label,
  onLabelChange,
}: {
  id: string;
  col: ColumnDef;
  label: string;
  onLabelChange: (value: string) => void;
}) {
  const isFixed = !!col.fixed;
  const isRenamable = col.renamable !== false;
  const [editing, setEditing] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isFixed,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
    boxShadow: isDragging ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] border transition-all ${
        isFixed
          ? "border-white/[0.04] bg-white/[0.02] opacity-60"
          : isDragging
          ? "border-primary-500/50 bg-primary-500/10 opacity-90"
          : "border-white/[0.08] bg-neutral-900 hover:border-primary-500/30 hover:bg-primary-500/5"
      }`}
    >
      <div
        {...(!isFixed ? attributes : {})}
        {...(!isFixed ? listeners : {})}
        className={isFixed ? "p-1 -ml-1 flex focus:outline-none cursor-not-allowed" : "cursor-grab active:cursor-grabbing p-1 -ml-1 flex focus:outline-none"}
      >
        {isFixed ? (
          <Lock className="h-4 w-4 text-neutral-600 shrink-0" />
        ) : (
          <GripVertical className="h-4 w-4 text-neutral-400 pointer-events-none shrink-0" />
        )}
      </div>

      {editing ? (
        <input
          autoFocus
          type="text"
          value={label}
          placeholder={col.label}
          onChange={(e) => onLabelChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.currentTarget.blur();
            }
          }}
          className="flex-1 min-w-0 text-sm font-medium bg-white/[0.06] text-neutral-100 rounded-[var(--radius-sm)] px-2 py-1 outline-none border border-primary-500/50"
        />
      ) : (
        <span
          className={`flex-1 min-w-0 truncate text-sm font-medium ${
            isFixed ? "text-neutral-500" : "text-neutral-200"
          }`}
        >
          {label}
        </span>
      )}

      {isRenamable && !editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Renomear coluna"
          className="p-1 rounded-[var(--radius-sm)] text-neutral-500 hover:text-primary-400 hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Lista arrastável de colunas (ordem + renomear), sem chrome de modal.
 *
 * Extraído do modal para que a página de Ajustes (/empresario/ajustes) edite
 * exatamente o mesmo controle — a migração "barra/drawer → página" não deve
 * significar uma segunda implementação de reordenação que sai do lugar da
 * primeira.
 */
export function ColumnOrderEditor({
  columns,
  order,
  labels,
  onOrderChange,
  onLabelsChange,
}: {
  columns: ColumnDef[];
  order: string[];
  labels: Record<string, string>;
  onOrderChange: (order: string[]) => void;
  onLabelsChange: (labels: Record<string, string>) => void;
}) {
  const getColumn = useCallback((id: string) => columns.find((c) => c.id === id), [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Coluna fixa não sai do lugar nem cede o lugar dela.
    const activeCol = getColumn(active.id as string);
    const overCol = getColumn(over.id as string);
    if (activeCol?.fixed || overCol?.fixed) return;

    const oldIndex = order.indexOf(active.id as string);
    const newIndex = order.indexOf(over.id as string);
    onOrderChange(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {order.map((colId) => {
            const col = getColumn(colId);
            if (!col) return null;
            return (
              <ColumnSortableItem
                key={colId}
                id={colId}
                col={col}
                label={labels[colId] ?? col.label}
                onLabelChange={(value) => {
                  const next = { ...labels };
                  // Rótulo vazio ou igual ao padrão não vira override — assim
                  // uma mudança futura no label default ainda chega ao usuário.
                  if (value.trim() === "" || value === col.label) delete next[colId];
                  else next[colId] = value;
                  onLabelsChange(next);
                }}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function ColumnConfigModal({
  open,
  onClose,
  columns,
  columnOrder,
  onSave,
  title,
  featureDefs,
  featureState,
  onFeaturesChange,
  columnLabels,
  onLabelsChange,
  defaultUnit,
  onDefaultUnitChange,
  unitOptions,
}: ColumnConfigModalProps) {
  const [order, setOrder] = useState<string[]>(columnOrder);
  const [labels, setLabels] = useState<Record<string, string>>(columnLabels ?? {});
  const [localUnit, setLocalUnit] = useState(defaultUnit ?? "");
  const [tab, setTab] = useState<"colunas" | "funcionalidades">("colunas");
  const [localFeatures, setLocalFeatures] = useState<Record<string, boolean>>(featureState ?? {});

  const temFuncionalidades = !!featureDefs && featureDefs.length > 0;

  useEffect(() => {
    if (open) {
      setOrder(columnOrder);
      setLabels(columnLabels ?? {});
      setLocalUnit(defaultUnit ?? "");
      setLocalFeatures(featureState ?? {});
      setTab("colunas");
    }
  }, [open, columnOrder, columnLabels, defaultUnit, featureState]);

  // Ordenação/renomeação vivem em ColumnOrderEditor (compartilhado com a
  // página de Ajustes) — aqui sobra só o chrome do modal.

  const handleSave = () => {
    onSave(order);
    onLabelsChange?.(labels);
    if (onDefaultUnitChange && localUnit) {
      onDefaultUnitChange(localUnit);
    }
    if (temFuncionalidades) {
      onFeaturesChange?.(localFeatures);
    }
    onClose();
  };

  const handleReset = () => {
    if (tab === "funcionalidades" && featureDefs) {
      setLocalFeatures(Object.fromEntries(featureDefs.map((f) => [f.id, true])));
      return;
    }
    const defaultOrder = columns.map((c) => c.id);
    setOrder(defaultOrder);
    setLabels({});
    if (unitOptions && unitOptions.length > 0) {
      setLocalUnit("CX"); // reset to CX
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-sm">
      <ModalHeader onClose={onClose}>{title ?? "Configurar Colunas"}</ModalHeader>
      <ModalBody className="space-y-4 max-h-[65vh] overflow-y-auto">
        {temFuncionalidades && (
          <div className="flex bg-neutral-900 p-1 rounded-lg border border-white/[0.06]">
            {(
              [
                ["colunas", "Colunas"],
                ["funcionalidades", "Funcionalidades"],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setTab(valor)}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all cursor-pointer ${
                  tab === valor
                    ? "bg-primary-600 text-white shadow"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        {temFuncionalidades && tab === "funcionalidades" ? (
          <div className="space-y-2">
            <p className="text-xs text-neutral-400">
              Desligue o que você não usa para deixar a tela mais limpa. Vale só para este
              navegador.
            </p>
            {featureDefs!.map((f) => {
              const ativo = localFeatures[f.id] !== false;
              return (
                <label
                  key={f.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-[var(--radius-md)] border border-white/[0.08] bg-neutral-900 hover:border-primary-500/30 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(e) =>
                      setLocalFeatures((prev) => ({ ...prev, [f.id]: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-white/20 accent-primary-500 shrink-0 cursor-pointer"
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-medium ${
                        ativo ? "text-neutral-200" : "text-neutral-500"
                      }`}
                    >
                      {f.label}
                    </span>
                    {f.description && (
                      <span className="block text-[11px] text-neutral-500 mt-0.5">
                        {f.description}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <>
            <p className="text-xs text-neutral-400 mb-3">
              Arraste para reordenar as colunas da tabela. Colunas com 🔒 são fixas. Use o lápis para renomear o texto de uma coluna.
            </p>

            <ColumnOrderEditor
              columns={columns}
              order={order}
              labels={labels}
              onOrderChange={setOrder}
              onLabelsChange={setLabels}
            />
          </>
        )}

        {/* Unidade padrão (só renderiza se as props forem fornecidas) */}
        {tab === "colunas" && unitOptions && unitOptions.length > 0 && onDefaultUnitChange && (
          <div className="pt-3 border-t border-white/[0.06] space-y-2 mt-4">
            <label className="text-xs font-medium text-neutral-300">
              Unidade padrão para novos itens
            </label>
            <div className="relative">
              <select
                value={localUnit}
                onChange={(e) => setLocalUnit(e.target.value)}
                className="w-full h-9 bg-neutral-900 border border-white/[0.08] rounded-[var(--radius-md)] text-white text-sm pl-3 pr-8 appearance-none outline-none focus:border-primary-500 transition-colors cursor-pointer"
              >
                {unitOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-neutral-900">
                    {opt.value} — {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
            </div>
            <p className="text-[11px] text-neutral-500">
              Novos itens adicionados à lista usarão esta unidade como padrão.
            </p>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Restaurar padrão
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

/* ─── Helpers de persistência ──────────────────────────────────────────────── */

export function loadColumnOrder(
  storageKey: string,
  defaultOrder: string[]
): string[] {
  if (typeof window === "undefined") return defaultOrder;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultOrder;
    const saved: string[] = JSON.parse(raw);
    // garante que todas as colunas default estão presentes
    const validSet = new Set(defaultOrder);
    const filtered = saved.filter((id) => validSet.has(id));
    // adiciona novas colunas que possam ter sido adicionadas
    const missing = defaultOrder.filter((id) => !filtered.includes(id));
    return [...filtered, ...missing];
  } catch {
    return defaultOrder;
  }
}

export function saveColumnOrder(storageKey: string, order: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(order));
}

function labelsStorageKey(storageKey: string): string {
  return `${storageKey}_labels`;
}

export function loadColumnLabels(storageKey: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(labelsStorageKey(storageKey));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveColumnLabels(storageKey: string, labels: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(labelsStorageKey(storageKey), JSON.stringify(labels));
}
