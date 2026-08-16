"use client";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { showToast } from "@/components/ui/toast";
import { Package } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export interface StockProduct {
  id: string;
  name: string;
  image_url?: string | null;
  barcode?: string | null;
}

interface StockModalProps {
  open: boolean;
  onClose: () => void;
  products: StockProduct[];
  /** Callback com map de productId -> estoque preenchido */
  onConfirm: (stockMap: Record<string, number>) => void;
}

export function StockModal({
  open,
  onClose,
  products,
  onConfirm,
}: StockModalProps) {
  const [stockValues, setStockValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    products.forEach((p) => (init[p.id] = "0"));
    return init;
  });
  const [applyAllValue, setApplyAllValue] = useState("");

  // Reset state when products change
  const isBatch = products.length > 1;

  const handleApplyAll = () => {
    const val = applyAllValue.trim();
    if (val === "") return;
    const newValues: Record<string, string> = {};
    products.forEach((p) => (newValues[p.id] = val));
    setStockValues(newValues);
    showToast(`Estoque "${val}" aplicado a todos os itens.`, "info");
  };

  const handleConfirm = () => {
    const stockMap: Record<string, number> = {};
    products.forEach((p) => {
      stockMap[p.id] = parseInt(stockValues[p.id] || "0") || 0;
    });
    onConfirm(stockMap);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className={isBatch ? "max-w-lg" : "max-w-sm"}
    >
      <ModalHeader onClose={onClose}>
        {isBatch
          ? `Informar estoque — ${products.length} itens`
          : "Informar estoque"}
      </ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-xs text-neutral-400">
          Informe o estoque atual antes de adicionar à lista de cotação.
        </p>

        {/* Ação em lote: aplicar para todos */}
        {isBatch && (
          <div className="flex items-end gap-2 p-3 bg-primary-500/5 border border-primary-500/10 rounded-[var(--radius-md)]">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-primary-300">
                Aplicar estoque para todos
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Ex: 10"
                value={applyAllValue}
                onChange={(e) => setApplyAllValue(e.target.value)}
                className="w-full bg-neutral-900 border border-white/[0.08] rounded-[var(--radius-md)] px-3 py-2 text-sm text-neutral-200 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleApplyAll}
              disabled={!applyAllValue.trim()}
            >
              Aplicar
            </Button>
          </div>
        )}

        {/* Lista de itens */}
        <div className={`space-y-2 ${isBatch ? "max-h-64 overflow-y-auto pr-1" : ""}`}>
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-2.5 border border-white/[0.06] rounded-[var(--radius-md)] bg-white/[0.02]"
            >
              {/* Thumb */}
              {p.image_url ? (
                <div className="relative h-9 w-9 rounded-md overflow-hidden bg-white/[0.06] shrink-0">
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    className="object-cover"
                    sizes="36px"
                  />
                </div>
              ) : (
                <div className="h-9 w-9 rounded-md bg-white/[0.04] flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-neutral-600" />
                </div>
              )}

              {/* Nome */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-200 truncate">
                  {p.name}
                </p>
                {p.barcode && (
                  <p className="text-[11px] text-neutral-500 font-mono">
                    {p.barcode}
                  </p>
                )}
              </div>

              {/* Input estoque */}
              <input
                type="number"
                min="0"
                step="1"
                value={stockValues[p.id] ?? "0"}
                onChange={(e) =>
                  setStockValues((prev) => ({
                    ...prev,
                    [p.id]: e.target.value,
                  }))
                }
                className="w-20 bg-neutral-900 border border-white/[0.08] rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-center text-neutral-200 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
              />
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm}>
          Confirmar e Adicionar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
