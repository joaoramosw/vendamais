"use client";

/**
 * useTableSort — Hook para ordenação multi-coluna em tabelas.
 *
 * Suporta:
 * - Click para alternar asc/desc/none
 * - Múltiplas colunas de ordenação simultânea
 * - Indicadores visuais de direção
 */

import { useCallback, useState } from "react";

export type SortDirection = "asc" | "desc";

export interface SortCriterion {
  column: string;
  direction: SortDirection;
}

export function useTableSort(initialSort: SortCriterion[] = []) {
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>(initialSort);

  const toggleSort = useCallback((column: string) => {
    setSortCriteria((prev) => {
      const existing = prev.find((s) => s.column === column);

      if (!existing) {
        // Adiciona como nova coluna de ordenação
        return [...prev, { column, direction: "asc" }];
      }

      if (existing.direction === "asc") {
        // Alterna para desc
        return prev.map((s) =>
          s.column === column ? { ...s, direction: "desc" as SortDirection } : s
        );
      }

      // Remove a ordenação (was desc -> remove)
      return prev.filter((s) => s.column !== column);
    });
  }, []);

  const clearSort = useCallback(() => {
    setSortCriteria([]);
  }, []);

  const getSortDirection = useCallback(
    (column: string): SortDirection | null => {
      const criterion = sortCriteria.find((s) => s.column === column);
      return criterion?.direction ?? null;
    },
    [sortCriteria]
  );

  const getSortIndex = useCallback(
    (column: string): number => {
      const index = sortCriteria.findIndex((s) => s.column === column);
      return index >= 0 ? index + 1 : -1;
    },
    [sortCriteria]
  );

  return {
    sortCriteria,
    toggleSort,
    clearSort,
    getSortDirection,
    getSortIndex,
    hasSorts: sortCriteria.length > 0,
  };
}

/**
 * Aplica ordenação multi-critério a um array de items.
 * `getField` retorna o valor para comparação dado um item e o nome da coluna.
 */
export function applySorting<T>(
  items: T[],
  criteria: SortCriterion[],
  getField: (item: T, column: string) => string | number | null | undefined
): T[] {
  if (criteria.length === 0) return items;

  return [...items].sort((a, b) => {
    for (const { column, direction } of criteria) {
      const aVal = getField(a, column);
      const bVal = getField(b, column);

      // null/undefined para o final
      if (aVal == null && bVal == null) continue;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp: number;
      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal, "pt-BR", { sensitivity: "base" });
      } else {
        cmp = Number(aVal) - Number(bVal);
      }

      if (cmp !== 0) {
        return direction === "asc" ? cmp : -cmp;
      }
    }
    return 0;
  });
}
