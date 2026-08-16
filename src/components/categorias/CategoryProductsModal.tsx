"use client";

import { getProductsByCategory, type CategoryProductSummary } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils";
import { ExternalLink, Loader2, Package, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/** Teto de itens trazidos de uma vez — o modal é um resumo, não a listagem. */
const LIMITE = 60;

interface CategoryProductsModalProps {
  /** Categoria aberta; `null` mantém o modal fechado. */
  category: { id: string; name: string; color: string | null } | null;
  onClose: () => void;
}

export function CategoryProductsModal({ category, onClose }: CategoryProductsModalProps) {
  const [products, setProducts] = useState<CategoryProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const categoryId = category?.id ?? null;

  useEffect(() => {
    if (!categoryId) return;
    let cancelado = false;

    setLoading(true);
    setError(null);
    setBusca("");

    getProductsByCategory(categoryId, LIMITE)
      .then((res) => {
        if (cancelado) return;
        if (res.error) {
          setError(res.error);
          return;
        }
        setProducts(res.products);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelado) setError("Não foi possível carregar os produtos desta categoria.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [categoryId]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(termo) || (p.barcode ?? "").toLowerCase().includes(termo),
    );
  }, [products, busca]);

  if (!category) return null;

  const naoCarregados = total - products.length;

  return (
    <Modal open onClose={onClose} className="max-w-2xl">
      <ModalHeader onClose={onClose}>
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: category.color || "#6366f1" }}
          />
          Produtos em {category.name}
        </span>
      </ModalHeader>

      <ModalBody className="space-y-3 max-h-[65vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
            Carregando produtos...
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-danger-400">{error}</p>
        ) : products.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            Nenhum produto associado a esta categoria ainda.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-500">
                {total} {total === 1 ? "produto" : "produtos"}
                {naoCarregados > 0 && ` · mostrando os ${products.length} primeiros`}
              </p>
              {products.length > 8 && (
                <div className="relative w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Filtrar..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="w-full h-8 pl-8 pr-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/[0.08] rounded-[var(--radius-md)] text-xs text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-500 outline-none focus:border-primary-400 transition-colors"
                  />
                </div>
              )}
            </div>

            {visiveis.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">
                Nenhum produto encontrado para “{busca.trim()}”.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {visiveis.map((p) => (
                  <Link
                    key={p.id}
                    href={`/empresario/produtos/editar/${p.id}`}
                    className="flex items-center gap-3 p-2 rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/[0.06] hover:border-primary-500/40 hover:bg-primary-500/[0.04] transition-colors"
                  >
                    <div className="relative h-11 w-11 shrink-0 rounded-[var(--radius-md)] overflow-hidden bg-neutral-100 dark:bg-white/[0.04]">
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt={p.name}
                          fill
                          className="object-cover"
                          sizes="44px"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-neutral-500" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-800 dark:text-neutral-200 line-clamp-2">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">
                        {p.price_unit_store > 0 ? (
                          <span className="font-semibold text-success-500">
                            {formatCurrency(p.price_unit_store)}
                          </span>
                        ) : (
                          <span className="italic">Sem preço</span>
                        )}
                        {p.barcode && <span className="font-mono"> · {p.barcode}</span>}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </ModalBody>

      <ModalFooter className="justify-between">
        <Link href={`/empresario/produtos?category=${encodeURIComponent(category.name)}`}>
          <Button variant="ghost" size="sm" type="button">
            <ExternalLink className="h-4 w-4" />
            Ver na listagem de produtos
          </Button>
        </Link>
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
