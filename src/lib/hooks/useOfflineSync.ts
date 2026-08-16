"use client";

import { salvarRascunho, publicarCotacaoPorId } from "@/lib/api/cotacoes-api";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftItem } from "./useDraftList";

const SYNC_QUEUE_KEY = "vendamais_sync_queue";
const RETRY_BASE_DELAY_MS = 2_000;
const RETRY_MAX_DELAY_MS = 60_000;

export interface SyncAction {
  id: string;
  type: "CREATE_QUOTATION";
  payload: {
    titulo: string;
    descricao?: string;
    data_limite?: string;
    itens: QueuedCotacaoItem[];
    publishAfterCreate?: boolean;
    createdCotacaoId?: string;
  };
  timestamp: number;
  retryCount?: number;
  nextAttemptAt?: number;
}

interface QueuedCotacaoItem {
  nome_produto: string;
  codigo_barras?: string;
  categoria?: string;
  estoque_atual?: number;
  quantidade_sugerida: number;
  unidade: DraftItem["tipoUnidade"];
  tipo_unidade: DraftItem["tipoUnidade"];
  quantidade: number;
  product_id: string;
}

function toQueuedCotacaoItem(item: DraftItem): QueuedCotacaoItem {
  const quantidade = Number.isFinite(item.quantidadeSugerida)
    ? Math.trunc(item.quantidadeSugerida)
    : 0;

  return {
    nome_produto: item.nome,
    codigo_barras: item.codigoBarras || undefined,
    categoria: item.categoria || undefined,
    estoque_atual: item.estoque > 0 ? item.estoque : undefined,
    quantidade_sugerida: quantidade,
    unidade: item.tipoUnidade,
    tipo_unidade: item.tipoUnidade,
    quantidade,
    product_id: item.productId,
  };
}

function getQueueItems(action: SyncAction): QueuedCotacaoItem[] {
  // backward compat with previously queued payload.items (DraftItem[])
  const legacyItems = (action as SyncAction & { payload: { items?: DraftItem[] } })
    .payload.items;
  if (Array.isArray(legacyItems)) {
    return legacyItems.map(toQueuedCotacaoItem);
  }
  return action.payload.itens ?? [];
}

async function syncCreateQuotationAction(
  action: SyncAction,
  persistAction: (updatedAction: SyncAction) => Promise<void> | void
): Promise<"synced" | "invalid"> {
  const itens = getQueueItems(action).filter((item) => item.quantidade > 0);

  if (itens.length === 0) {
    return "invalid";
  }

  let currentAction = action;
  let cotacaoId = currentAction.payload.createdCotacaoId;

  if (!cotacaoId) {
    // Backend novo (NestJS/Fastify) — mesma sequência criar (sem publicar)
    // usada pelo salvarRascunho do formulário online.
    const result = await salvarRascunho({
      titulo: currentAction.payload.titulo,
      data_limite: currentAction.payload.data_limite || undefined,
      itens,
    });
    if (!result.success) throw new Error(result.error);

    cotacaoId = result.id;
    currentAction = {
      ...currentAction,
      payload: {
        ...currentAction.payload,
        createdCotacaoId: cotacaoId,
      },
    };

    await persistAction(currentAction);
  }

  if (!cotacaoId) {
    throw new Error("Cotação offline criada sem ID retornado.");
  }

  if (currentAction.payload.publishAfterCreate ?? true) {
    const publishResult = await publicarCotacaoPorId(cotacaoId);
    if (!publishResult.success) {
      throw new Error(publishResult.error);
    }
  }

  return "synced";
}

function parseQueue(raw: string | null): SyncAction[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SyncAction[];
  } catch {
    return [];
  }
}

function generateActionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const IDB_DB_NAME = "vendamais_offline";
const IDB_DB_VERSION = 1;
const IDB_QUEUE_STORE = "sync_queue";

let dbPromise: Promise<IDBDatabase> | null = null;

function canUseIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openQueueDb(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error("IndexedDB indisponível"));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);

    request.onerror = () => {
      const error = request.error ?? new Error("Falha ao abrir IndexedDB");
      dbPromise = null;
      reject(error);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_QUEUE_STORE)) {
        db.createObjectStore(IDB_QUEUE_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha na requisição IndexedDB"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha na transação IndexedDB"));
    tx.onabort = () => reject(tx.error ?? new Error("Transação IndexedDB abortada"));
  });
}

async function idbGetAllActions(): Promise<SyncAction[]> {
  const db = await openQueueDb();
  const tx = db.transaction(IDB_QUEUE_STORE, "readonly");
  const store = tx.objectStore(IDB_QUEUE_STORE);
  const result = await requestToPromise(store.getAll() as IDBRequest<SyncAction[]>);
  await transactionDone(tx);
  return Array.isArray(result) ? result : [];
}

async function idbPutAction(action: SyncAction): Promise<void> {
  const db = await openQueueDb();
  const tx = db.transaction(IDB_QUEUE_STORE, "readwrite");
  const store = tx.objectStore(IDB_QUEUE_STORE);
  await requestToPromise(store.put(action));
  await transactionDone(tx);
}

async function idbDeleteAction(id: string): Promise<void> {
  const db = await openQueueDb();
  const tx = db.transaction(IDB_QUEUE_STORE, "readwrite");
  const store = tx.objectStore(IDB_QUEUE_STORE);
  await requestToPromise(store.delete(id));
  await transactionDone(tx);
}

async function idbCountActions(): Promise<number> {
  const db = await openQueueDb();
  const tx = db.transaction(IDB_QUEUE_STORE, "readonly");
  const store = tx.objectStore(IDB_QUEUE_STORE);
  const result = await requestToPromise(store.count());
  await transactionDone(tx);
  return typeof result === "number" ? result : 0;
}

async function idbBulkPutActions(actions: SyncAction[]): Promise<void> {
  if (actions.length === 0) return;

  const db = await openQueueDb();
  const tx = db.transaction(IDB_QUEUE_STORE, "readwrite");
  const store = tx.objectStore(IDB_QUEUE_STORE);
  actions.forEach((a) => store.put(a));
  await transactionDone(tx);
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncPending, setSyncPending] = useState(false);
  const [queueLength, setQueueLength] = useState(0);

  const syncPendingRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const processQueueRef = useRef<() => void>(() => {});
  const storageRef = useRef<"idb" | "local">("idb");

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const scheduleNextRetry = useCallback(
    (queue: SyncAction[]) => {
      clearRetryTimer();

      if (!queue || queue.length === 0) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const now = Date.now();
      let nextAttemptAt: number | null = null;

      for (const action of queue) {
        const nextAt = action.nextAttemptAt;
        if (typeof nextAt !== "number" || nextAt <= now) continue;
        nextAttemptAt =
          nextAttemptAt === null ? nextAt : Math.min(nextAttemptAt, nextAt);
      }

      if (!nextAttemptAt) return;

      retryTimerRef.current = window.setTimeout(() => {
        processQueueRef.current();
      }, Math.max(0, nextAttemptAt - now));
    },
    [clearRetryTimer]
  );

  const processQueue = useCallback(async () => {
    if (syncPendingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    let queue: SyncAction[] = [];

    if (storageRef.current === "idb") {
      try {
        queue = await idbGetAllActions();
      } catch (error) {
        console.error("Erro ao ler fila do IndexedDB. Usando localStorage.", error);
        storageRef.current = "local";
      }
    }

    if (storageRef.current === "local") {
      queue = parseQueue(localStorage.getItem(SYNC_QUEUE_KEY));
    }

    if (queue.length === 0) return;

    syncPendingRef.current = true;
    setSyncPending(true);
    clearRetryTimer();

    try {
      const now = Date.now();
      const sortedQueue = [...queue].sort((a, b) => a.timestamp - b.timestamp);

      if (storageRef.current === "idb") {
        for (const action of sortedQueue) {
          const nextAttemptAt = action.nextAttemptAt ?? 0;
          if (nextAttemptAt > now) {
            continue;
          }

          let actionForRetry = action;

          try {
            if (action.type === "CREATE_QUOTATION") {
              const result = await syncCreateQuotationAction(action, async (updatedAction) => {
                actionForRetry = updatedAction;
                await idbPutAction(updatedAction);
              });

              if (result === "invalid") {
                console.error(
                  `Cotacao offline ${action.id} removida: nenhum item valido para envio.`
                );
                await idbDeleteAction(action.id);
                continue;
              }

              await idbDeleteAction(action.id);
              continue;
            }

            // Unknown action: keep it (defensive).
          } catch (error) {
            const retryCount = (action.retryCount ?? 0) + 1;
            const expDelay = Math.min(
              RETRY_BASE_DELAY_MS * 2 ** Math.min(retryCount - 1, 10),
              RETRY_MAX_DELAY_MS
            );
            const jitter = Math.floor(Math.random() * 750);
            const nextAt = Date.now() + expDelay + jitter;

            console.error(
              `Falha ao sincronizar action ${action.id} (tentativa ${retryCount})`,
              error
            );

            await idbPutAction({
              ...actionForRetry,
              retryCount,
              nextAttemptAt: nextAt,
            });
          }
        }

        const remainingQueue = await idbGetAllActions();
        setQueueLength(remainingQueue.length);

        if (queue.length > 0 && remainingQueue.length === 0) {
          window.dispatchEvent(new CustomEvent("sync_completed"));
        }

        scheduleNextRetry(remainingQueue);
        return;
      }

      const remainingQueue: SyncAction[] = [];

      for (const action of sortedQueue) {
        const nextAttemptAt = action.nextAttemptAt ?? 0;
        if (nextAttemptAt > now) {
          remainingQueue.push(action);
          continue;
        }

        let actionForRetry = action;

        try {
          if (action.type === "CREATE_QUOTATION") {
            const result = await syncCreateQuotationAction(action, async (updatedAction) => {
              actionForRetry = updatedAction;
              const currentQueue = parseQueue(localStorage.getItem(SYNC_QUEUE_KEY));
              const updatedQueue = currentQueue.map((queuedAction) =>
                queuedAction.id === updatedAction.id ? updatedAction : queuedAction
              );
              localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));
            });

            if (result === "invalid") {
              console.error(
                `Cotacao offline ${action.id} removida: nenhum item valido para envio.`
              );
              continue;
            }

            continue;
          }

          // Unknown action: keep it (defensive).
          remainingQueue.push(action);
        } catch (error) {
          const retryCount = (action.retryCount ?? 0) + 1;
          const expDelay = Math.min(
            RETRY_BASE_DELAY_MS * 2 ** Math.min(retryCount - 1, 10),
            RETRY_MAX_DELAY_MS
          );
          const jitter = Math.floor(Math.random() * 750);
          const nextAt = Date.now() + expDelay + jitter;

          console.error(
            `Falha ao sincronizar action ${action.id} (tentativa ${retryCount})`,
            error
          );

          remainingQueue.push({
            ...actionForRetry,
            retryCount,
            nextAttemptAt: nextAt,
          });
        }
      }

      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
      setQueueLength(remainingQueue.length);

      if (queue.length > 0 && remainingQueue.length === 0) {
        window.dispatchEvent(new CustomEvent("sync_completed"));
      }

      scheduleNextRetry(remainingQueue);
    } catch (error) {
      console.error("Erro no processamento da fila", error);
    } finally {
      syncPendingRef.current = false;
      setSyncPending(false);
    }
  }, [clearRetryTimer, scheduleNextRetry]);

  processQueueRef.current = () => {
    void processQueue();
  };

  const queueAction = useCallback(
    async (action: Omit<SyncAction, "id" | "timestamp">): Promise<SyncAction | null> => {
      const newAction: SyncAction = {
        ...action,
        id: generateActionId(),
        timestamp: Date.now(),
        retryCount: 0,
      };

      if (storageRef.current === "idb") {
        try {
          await idbPutAction(newAction);
          const count = await idbCountActions();
          setQueueLength(count);
          return newAction;
        } catch (error) {
          console.error("Erro ao enfileirar ação no IndexedDB. Usando localStorage.", error);
          storageRef.current = "local";
        }
      }

      try {
        const stored = localStorage.getItem(SYNC_QUEUE_KEY);
        const queue = parseQueue(stored);

        const newQueue = [...queue, newAction];
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(newQueue));
        setQueueLength(newQueue.length);
        return newAction;
      } catch (error) {
        console.error("Erro ao enfileirar ação", error);
        return null;
      }
    },
    []
  );

  // Inicializa o estado olhando pro navigator + fila local/IndexedDB
  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    let cancelled = false;

    const init = async () => {
      if (storageRef.current === "idb") {
        try {
          await openQueueDb();

          // Migra fila antiga do localStorage para IndexedDB (se existir)
          const legacyQueue = parseQueue(localStorage.getItem(SYNC_QUEUE_KEY));
          if (legacyQueue.length > 0) {
            await idbBulkPutActions(legacyQueue);
            localStorage.removeItem(SYNC_QUEUE_KEY);
          }

          const count = await idbCountActions();
          if (!cancelled) setQueueLength(count);
          return;
        } catch (error) {
          console.error("IndexedDB indisponível. Usando localStorage.", error);
          storageRef.current = "local";
        }
      }

      const queue = parseQueue(localStorage.getItem(SYNC_QUEUE_KEY));
      if (!cancelled) setQueueLength(queue.length);
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listeners de Rede
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Processador Background Trigger (acionado ao voltar online)
  useEffect(() => {
    if (isOnline && queueLength > 0) {
      processQueue();
    } else if (!isOnline) {
      clearRetryTimer();
    }

    return () => {
      clearRetryTimer();
    };
  }, [clearRetryTimer, isOnline, processQueue, queueLength]);

  return {
    isOnline,
    syncPending,
    queueLength,
    queueAction,
    processQueue, // manual retry if needed
  };
}
