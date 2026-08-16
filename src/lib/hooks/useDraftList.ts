"use client";

/**
 * useDraftList — store global de items da lista de cotação.
 *
 * Usa useSyncExternalStore para que TODOS os componentes que chamam este hook
 * recebam atualizações imediatas quando qualquer um deles modificar a lista —
 * sem Context, sem Zustand, sem refresh de página.
 *
 * O state é persistido no localStorage e sincronizado entre abas via
 * window.storage event.
 */

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "vendamais_draft_list";

export interface DraftObservation {
  id: string;
  texto: string;
  autor: string;
  dataCriacao: string;
  resolvida: boolean;
}

export interface DraftItem {
  productId: string;
  nome: string;
  foto: string | null;
  codigoBarras: string | null;
  categoria: string | null;
  precoAtual: number | null;
  estoque: number;
  quantidadeSugerida: number;
  tipoUnidade: "UN" | "CX" | "DZ" | "FD";
  observacoes?: DraftObservation[];
}

// ─── Store singleton ───────────────────────────────────────────────────────────

type Listener = () => void;

let _items: DraftItem[] = [];
let _loaded = false;
const _listeners = new Set<Listener>();
const VALID_UNITS = new Set<DraftItem["tipoUnidade"]>(["UN", "CX", "DZ", "FD"]);

function _normalizeDraftItem(item: DraftItem): DraftItem {
  // `0` é o estado "vazio" da quantidade de cotação: o item entra na lista sem
  // número e a célula pede o preenchimento (EditableNumberCell com min=0). O
  // envio da cotação já barra item com quantidade zero, então nada escapa sem
  // quantidade — antes o normalizador forçava `1`, um valor que ninguém
  // escolheu e que ia pro fornecedor como se fosse decisão do comprador.
  const quantidadeSugerida = Number.isFinite(item.quantidadeSugerida)
    ? Math.max(0, Math.trunc(item.quantidadeSugerida))
    : 0;
  const estoque = Number.isFinite(item.estoque) ? Math.max(0, Math.trunc(item.estoque)) : 0;
  const tipoUnidade = VALID_UNITS.has(item.tipoUnidade) ? item.tipoUnidade : "UN";

  return {
    ...item,
    quantidadeSugerida,
    estoque,
    tipoUnidade,
  };
}

function _notify() {
  _listeners.forEach((l) => l());
}

function _save(items: DraftItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    // Safari privado / quota excedida no mobile não deve derrubar a UI —
    // a lista continua funcionando em memória nesta sessão.
    console.error("Erro ao salvar lista de cotação no localStorage.", error);
  }
}

function _load(): DraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is DraftItem => {
        return !!item && typeof item === "object" && typeof (item as DraftItem).productId === "string";
      })
      .map(_normalizeDraftItem);
  } catch {
    return [];
  }
}

/** Inicializa store uma única vez no client */
function _init() {
  if (_loaded || typeof window === "undefined") return;
  _items = _load();
  _loaded = true;

  // Sincroniza quando outra aba altera o localStorage
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      _items = _load();
      _notify();
    }
  });
}

function _setItems(items: DraftItem[]) {
  const normalizedItems = items.map(_normalizeDraftItem);
  _items = normalizedItems;
  _save(normalizedItems);
  _notify();
}

// ─── useSyncExternalStore glue ─────────────────────────────────────────────────

function subscribe(listener: Listener) {
  _init();
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

function getSnapshot(): DraftItem[] {
  _init();
  return _items;
}

const EMPTY_ITEMS: DraftItem[] = [];

function getServerSnapshot(): DraftItem[] {
  return EMPTY_ITEMS;
}

// ─── Hook público ─────────────────────────────────────────────────────────────

export function useDraftList() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addItem = useCallback((item: DraftItem) => {
    const current = _items;
    if (current.some((i) => i.productId === item.productId)) return;
    _setItems([...current, item]);
  }, []);

  const removeItem = useCallback((productId: string) => {
    _setItems(_items.filter((i) => i.productId !== productId));
  }, []);

  const updateItem = useCallback(
    (productId: string, updates: Partial<Omit<DraftItem, "productId">>) => {
      _setItems(
        _items.map((i) =>
          i.productId === productId ? { ...i, ...updates } : i
        )
      );
    },
    []
  );

  const clearAll = useCallback(() => {
    _setItems([]);
  }, []);

  const hasItem = useCallback(
    (productId: string) => _items.some((i) => i.productId === productId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items] // recomputa quando items muda
  );

  return {
    items,
    count: items.length,
    loaded: _loaded,
    addItem,
    removeItem,
    updateItem,
    clearAll,
    hasItem,
  };
}
