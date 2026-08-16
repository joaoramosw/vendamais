"use client";

/**
 * Contadores usados nos badges da sidebar — atualizam ao montar, a cada
 * POLL_INTERVAL_MS e quando a aba volta a ficar em foco (cobre o caso comum
 * de abrir uma cotação em outra aba e responder por lá). Falhas de rede são
 * engolidas de propósito: um badge que não atualiza não deveria virar um
 * toast de erro na sidebar.
 */

import { useCallback, useEffect, useState } from "react";
import { listarCotacoes } from "@/lib/api/cotacoes-api";
import { listarMeusConvites } from "@/lib/api/fornecedor-api";

const POLL_INTERVAL_MS = 30_000;

function usePolledCount(fetchCount: () => Promise<number>, enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    function load() {
      fetchCount()
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {});
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, [fetchCount, enabled]);

  return enabled ? count : 0;
}

/** Empresário — cotações abertas que já têm ao menos 1 proposta recebida.
 * Passe `enabled: false` quando renderizado fora do contexto de empresário
 * (evita uma chamada de API que vai dar 403 à toa). */
export function useCotacoesAbertasComPropostas(enabled = true): number {
  const fetchCount = useCallback(async () => {
    const cotacoes = await listarCotacoes();
    return cotacoes.filter((c) => c.status === "aberta" && c.propostas.length > 0).length;
  }, []);

  return usePolledCount(fetchCount, enabled);
}

/** Fornecedor — cotações ativas (abertas) disponíveis para responder.
 * Passe `enabled: false` fora do contexto de fornecedor. */
export function useCotacoesAtivasFornecedor(enabled = true): number {
  const fetchCount = useCallback(async () => {
    const convites = await listarMeusConvites();
    return convites.filter((c) => c.cotacao?.status === "aberta").length;
  }, []);

  return usePolledCount(fetchCount, enabled);
}
