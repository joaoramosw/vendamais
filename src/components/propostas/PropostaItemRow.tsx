"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export interface PropostaItemResumo {
  id: string;
  produto_nome: string;
  preco_unitario: number;
  observacao: string | null;
  disponivel: boolean;
}

interface PropostaItemRowProps {
  item: PropostaItemResumo;
  /** Aciona a visualização de detalhes do item. A linha inteira é o alvo. */
  onClick: () => void;
  /** Controla a rotação do chevron quando o chamador usa expansão inline. */
  expanded?: boolean;
}

/**
 * Linha enxuta de item da proposta: nome, tag essencial e **apenas o preço
 * unitário ofertado**. Quantidade e total por linha existem nos dados, mas não
 * são renderizados aqui — a etapa de análise não decide por eles.
 *
 * A linha inteira é clicável (mesmo padrão de `PropostaItemRowCompact`:
 * `role="button"` + Enter/Espaço), com o chevron servindo só de affordance
 * visual — por isso ele é `aria-hidden` e não recebe foco próprio.
 */
export function PropostaItemRow({ item, onClick, expanded = false }: PropostaItemRowProps) {
  const naoTenho = !item.disponivel;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex w-full items-center gap-3 px-1 py-3 text-left cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 rounded-[var(--radius-sm)]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate">
          {item.produto_nome}
        </p>
        {naoTenho && (
          <Badge variant="recusada" className="mt-1">
            Não tenho
          </Badge>
        )}
      </div>

      <p
        className={`text-sm font-semibold shrink-0 tabular-nums ${
          naoTenho
            ? "text-neutral-400 dark:text-neutral-500"
            : "text-neutral-900 dark:text-white"
        }`}
      >
        {naoTenho ? "—" : formatCurrency(item.preco_unitario)}
      </p>

      <ChevronRight
        aria-hidden
        className={`h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500 transition-transform ${
          expanded ? "rotate-90" : ""
        }`}
      />
    </div>
  );
}
