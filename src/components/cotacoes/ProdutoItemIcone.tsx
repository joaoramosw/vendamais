"use client";

/**
 * Ícone de caixa que antecede o nome do produto na comparação de cotações.
 *
 * Estado normal: o mesmo ícone discreto de sempre. Com observação de algum
 * fornecedor no item, cresce um pouco e pulsa em dourado — o único aviso, na
 * tabela, de que existe texto livre esperando no acesso rápido do item.
 *
 * Desktop e mobile usam este componente; a regra de "tem observação" é pura e
 * mora em `src/lib/cotacao-observacoes.ts`.
 */

import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { rotuloObservacoes } from "@/lib/cotacao-observacoes";

export function ProdutoItemIcone({
  totalObservacoes,
  className,
}: {
  totalObservacoes: number;
  className?: string;
}) {
  if (totalObservacoes === 0) {
    return <Package className={cn("h-3.5 w-3.5 text-neutral-500 shrink-0", className)} aria-hidden />;
  }

  return (
    <Package
      className={cn(
        // Um pouco maior que o padrão (h-3.5) + dourado pulsante. A animação
        // vive em globals.css (`.icone-observacao`) e respeita
        // prefers-reduced-motion; a cor é o mesmo par das colocações.
        "h-4.5 w-4.5 shrink-0 icone-observacao text-rank-gold dark:text-rank-gold-dark",
        className,
      )}
      // Nome acessível, não tooltip: o corpo da tabela não tem mais tooltips
      // (a explicação das colunas ficou só no cabeçalho).
      role="img"
      aria-label={rotuloObservacoes(totalObservacoes)}
    />
  );
}
