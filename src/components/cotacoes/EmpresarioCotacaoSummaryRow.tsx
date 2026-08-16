"use client";

import { Badge } from "@/components/ui/badge";
import { PROPOSTA_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { Package } from "lucide-react";

interface CotacaoItem {
  id: string;
  nome_produto: string;
  quantidade: number;
}

interface Proposta {
  id: string;
  status: string;
  valor_total: number | null;
}

interface EmpresarioCotacaoSummaryRowProps {
  itens: CotacaoItem[];
  propostas: Proposta[];
}

/**
 * Resumo leve pra listagem — sem comparação item-a-item (isso exigiria
 * proposta_itens de cada proposta, que não vem no endpoint de listagem por
 * questão de custo; ver a página de detalhe da cotação pra isso).
 */
export function EmpresarioCotacaoSummaryRow({
  itens,
  propostas,
}: EmpresarioCotacaoSummaryRowProps) {
  const acceptedProposta = propostas.find((p) => p.status === "aceita");

  if (itens.length === 0) {
    return (
      <div className="px-5 pb-5 pt-2 text-xs text-neutral-500 italic">
        Sem itens nesta cotação.
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      {acceptedProposta && (
        <div className="mb-3 flex items-center gap-2 text-xs text-success-400 bg-success-500/10 border border-success-500/20 rounded-lg px-3 py-2">
          <span className="font-bold">✓ Proposta aceita</span>
          {acceptedProposta.valor_total != null && (
            <>
              <span className="text-success-400/50 mx-1">·</span>
              <span className="font-bold">
                {formatCurrency(acceptedProposta.valor_total)} total
              </span>
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-white/[0.06]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-neutral-50 dark:bg-white/[0.03] border-b border-neutral-200 dark:border-white/[0.06]">
              <th className="px-3 py-2 text-left text-neutral-500 font-semibold uppercase tracking-wide">
                Produto
              </th>
              <th className="px-3 py-2 text-center text-neutral-500 font-semibold uppercase tracking-wide">
                Qtd.
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-white/[0.04]">
            {itens.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                    <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[220px]">
                      {item.nome_produto}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center text-neutral-500 dark:text-neutral-400 font-medium">
                  {item.quantidade}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Proposal status summary */}
      {propostas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {propostas.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.05] rounded-full px-2.5 py-1"
            >
              <Badge
                variant={
                  p.status === "aceita"
                    ? "aceita"
                    : p.status === "recusada"
                    ? "recusada"
                    : "enviada"
                }
                className="text-[9px] px-1.5 py-0"
              >
                {PROPOSTA_STATUS_LABELS[p.status as keyof typeof PROPOSTA_STATUS_LABELS] ??
                  p.status}
              </Badge>
              {p.valor_total != null && (
                <span className="text-neutral-500 font-medium">
                  {formatCurrency(p.valor_total)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
