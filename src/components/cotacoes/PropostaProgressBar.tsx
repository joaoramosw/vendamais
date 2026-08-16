"use client";

import { CheckCircle2 } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";

interface PropostaProgressBarProps {
  respondidos: number;
  total: number;
}

/**
 * Barra fixa no topo — deliberadamente `sticky`, não `fixed`: participando
 * do fluxo normal do documento, ela nunca fica sobre o campo em foco quando
 * o teclado virtual do mobile abre. Não trocar para `fixed` sem resolver
 * esse problema primeiro.
 */
export function PropostaProgressBar({ respondidos, total }: PropostaProgressBarProps) {
  // Sentinela de 1px logo acima da barra — quando ela sai da viewport (ao
  // rolar), a barra ganha sombra. Evita um listener de scroll manual.
  const { ref: sentinelRef, inView: noTopo } = useInView({ initialInView: true });

  const completo = total > 0 && respondidos === total;
  const percentual = total > 0 ? Math.round((respondidos / total) * 100) : 0;

  return (
    <>
      <div ref={sentinelRef} className="h-px" />
      <div
        className={cn(
          "sticky top-0 z-20 bg-neutral-900 border-b border-white/[0.08] rounded-b-xl px-4 py-3 transition-shadow",
          !noTopo && "shadow-lg shadow-black/30",
        )}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-sm font-medium text-white truncate">Progresso</span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold shrink-0",
              completo ? "text-success-400" : "text-neutral-400",
            )}
          >
            {completo && <CheckCircle2 className="h-3.5 w-3.5" />}
            {completo ? "Tudo respondido" : `${respondidos} de ${total} respondidos`}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              completo ? "bg-success-500" : "bg-primary-500",
            )}
            style={{ width: `${percentual}%` }}
          />
        </div>
      </div>
    </>
  );
}
