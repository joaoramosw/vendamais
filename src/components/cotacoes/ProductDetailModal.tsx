"use client";

import { Badge } from "@/components/ui/badge";
import { type UnitType, UNIT_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { MessageSquare, Package, Trophy, X } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

interface ProductDetailModalProps {
  open: boolean;
  onClose: () => void;
  item: any;
  propostas: any[];
}

export function ProductDetailModal({ open, onClose, item, propostas }: ProductDetailModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !item) return null;

  const unitType = (item.tipo_unidade || "UN") as UnitType;
  const imageUrl = item.products?.image_url;
  const storePrice = item.products?.price_unit_store;

  // Build supplier prices for this item, ranked by price ascending
  const supplierPrices = propostas
    .map((p: any) => {
      const pi = p.proposta_itens?.find((pi: any) => pi.cotacao_item_id === item.id);
      return {
        propostaId: p.id,
        supplier: p.profiles?.empresa || p.profiles?.nome || "Fornecedor",
        price: pi?.preco_unitario ?? 0,
        naoTem: !pi || pi.preco_unitario === 0,
        observacao: pi?.observacao || "",
        propostaObs: p.observacao || "",
        status: p.status,
      };
    })
    .sort((a, b) => {
      // NT items go last
      if (a.naoTem && !b.naoTem) return 1;
      if (!a.naoTem && b.naoTem) return -1;
      return a.price - b.price;
    });

  // Sem emoji de medalha: a colocação é dita pelo número e pela cor
  // (ouro/prata/bronze, tokens do tema) — mesma linguagem visual da tabela
  // de comparação.
  const positionColors = [
    "text-rank-gold dark:text-rank-gold-dark bg-rank-gold/10",
    "text-rank-silver dark:text-rank-silver-dark bg-rank-silver/10",
    "text-rank-bronze dark:text-rank-bronze-dark bg-rank-bronze/10",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg max-h-[90vh] bg-neutral-900 border border-white/[0.08] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-white/[0.06]">
          {imageUrl ? (
            <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-white/[0.06] border border-white/[0.05]">
              <Image src={imageUrl} alt={item.nome_produto} fill className="object-cover" sizes="64px" />
            </div>
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-xl bg-white/[0.04] border border-white/[0.05] flex items-center justify-center">
              <Package className="h-7 w-7 text-neutral-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{item.nome_produto}</h2>
            {item.descricao && (
              <p className="text-sm text-neutral-400 italic mt-0.5 line-clamp-1">{item.descricao}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                unitType === "UN" ? "bg-info-500/10 text-info-400" :
                unitType === "CX" ? "bg-violet-500/10 text-violet-400" :
                "bg-warning-500/10 text-warning-400"
              }`}>
                {unitType}
              </span>
              <span className="text-sm text-neutral-400">
                Qtd: <span className="font-semibold text-neutral-300">{item.quantidade_sugerida || item.quantidade}</span>
              </span>
              {storePrice > 0 && (
                <span className="text-xs text-neutral-500">
                  Loja: <span className="font-bold text-neutral-400">{formatCurrency(storePrice)}</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Supplier Rankings */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider px-2 mb-3">
            Ranking de Fornecedores por Menor Preço/{unitType}
          </p>
          {supplierPrices.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-sm">
              Nenhuma proposta recebida para este item.
            </div>
          ) : (
            supplierPrices.map((sp, idx) => {
              const position = idx + 1;
              const isBest = idx === 0 && !sp.naoTem;
              return (
                <div
                  key={sp.propostaId}
                  className={`p-4 rounded-xl border transition-colors ${
                    sp.naoTem
                      ? "bg-danger-500/[0.03] border-danger-500/10"
                      : isBest
                      ? "bg-success-500/[0.05] border-success-500/20"
                      : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Position badge */}
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      sp.naoTem
                        ? "bg-danger-500/10 text-danger-400"
                        : positionColors[idx] || "bg-white/[0.08] text-neutral-400"
                    }`}>
                      {sp.naoTem ? "NT" : `${position}º`}
                    </div>

                    {/* Supplier info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-200 truncate">{sp.supplier}</p>
                      {sp.naoTem ? (
                        <Badge variant="danger" className="mt-1">Não tem este produto</Badge>
                      ) : (
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Sub: {formatCurrency(sp.price * (item.quantidade_sugerida || item.quantidade))}
                        </p>
                      )}
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      {sp.naoTem ? (
                        <span className="text-sm font-bold text-danger-400">NT</span>
                      ) : (
                        <>
                          <p className={`text-lg font-black ${isBest ? "text-success-400" : "text-white"}`}>
                            {formatCurrency(sp.price)}
                          </p>
                          <p className="text-[10px] text-neutral-500 uppercase">
                            por {UNIT_TYPE_LABELS[unitType] || unitType}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Observations */}
                  {(sp.observacao || sp.propostaObs) && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-warning-400 bg-warning-500/[0.05] p-2.5 rounded-lg border border-warning-500/10">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{sp.observacao || sp.propostaObs}</p>
                    </div>
                  )}

                  {isBest && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-success-400" />
                      <span className="text-[10px] font-bold text-success-400 uppercase tracking-wider">Melhor Preço</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
