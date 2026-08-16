"use client";

import { assignProductCategories } from "@/actions/categories";
import { updateProduct } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { PriceInput } from "@/components/ui/price-input";
import { showToast } from "@/components/ui/toast";
import type { ProductWithQuote } from "@/lib/types/database";
import { centsToDecimal, decimalToCents, formatCurrency, formatRelativeDate } from "@/lib/utils";
import { ExternalLink, Package, Save } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ProductQuickViewModalProps {
  product: ProductWithQuote | null;
  categories: { id: string; name: string; color: string }[];
  canUpdate: boolean;
  onClose: () => void;
  /** Chamado após um salvamento bem-sucedido — permite ao chamador atualizar a lista. */
  onSaved?: () => void;
}

/**
 * Acesso rápido ao produto: os mesmos campos principais da página de edição,
 * num modal, pra ajustar preço/nome/categoria sem perder o contexto da lista.
 * Troca de imagem continua só na página completa (envolve upload, compressão e
 * substituição no Storage) — o link "Abrir edição completa" leva pra lá.
 */
export function ProductQuickViewModal({
  product,
  categories,
  canUpdate,
  onClose,
  onSaved,
}: ProductQuickViewModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");
  const [priceCents, setPriceCents] = useState(0);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Recarrega o formulário sempre que outro produto é aberto.
  useEffect(() => {
    if (!product) return;
    setName(product.name ?? "");
    setBarcode(product.barcode ?? "");
    setDescription(product.description ?? "");
    setPriceCents(decimalToCents(product.price_unit_store ?? 0));
    setSelectedCategoryIds((product.categories ?? []).map((c) => c.id));
  }, [product]);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (!product) return;
    if (!name.trim()) {
      showToast("Nome do produto é obrigatório.", "warning");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("description", description);
      formData.set("barcode", barcode);
      // `products.category` (texto solto) é redundante com product_categories,
      // mas ainda é lido em outras telas — mantido em sincronia com a 1ª
      // categoria marcada, igual ao ProductForm.
      formData.set(
        "category",
        categories.find((c) => selectedCategoryIds.includes(c.id))?.name ?? ""
      );
      formData.set("image_url", product.image_url ?? "");
      formData.set("price_unit_store", String(centsToDecimal(priceCents)));

      const result = await updateProduct(product.id, formData);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }

      await assignProductCategories(product.id, selectedCategoryIds);
      showToast("Produto atualizado!", "success");
      router.refresh();
      onSaved?.();
      onClose();
    } catch {
      showToast("Erro ao salvar produto.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!product) return null;

  return (
    <Modal open onClose={saving ? () => {} : onClose} className="max-w-xl">
      <ModalHeader onClose={saving ? undefined : onClose}>Acesso rápido</ModalHeader>
      <ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="flex gap-4">
          <div className="relative h-24 w-24 shrink-0 rounded-[var(--radius-md)] overflow-hidden bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/10">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Package className="h-8 w-8 text-neutral-500" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <Input
              label="Nome *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canUpdate}
              autoFocus
            />
            <p className="text-[11px] text-neutral-500">
              A imagem é trocada na edição completa.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Código de barras"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="font-mono"
            disabled={!canUpdate}
          />
          <PriceInput
            label="Preço unit. loja"
            cents={priceCents}
            onCentsChange={setPriceCents}
            disabled={!canUpdate}
          />
        </div>

        <Textarea
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[80px]"
          disabled={!canUpdate}
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Categorias
          </label>
          {categories.length === 0 ? (
            <p className="text-xs text-neutral-500">Nenhuma categoria cadastrada.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const active = selectedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    disabled={!canUpdate}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer disabled:cursor-not-allowed ${
                      active
                        ? "text-white"
                        : "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-white/[0.05] hover:bg-neutral-200 dark:hover:bg-white/[0.09]"
                    }`}
                    style={active ? { backgroundColor: cat.color || "#6366f1" } : undefined}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {product.latest_quote && (
          <div className="rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/[0.06] px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">
              Última cotação
            </p>
            <p className="text-sm">
              <span className="font-bold text-success-500">
                {formatCurrency(product.latest_quote.price)}
              </span>
              <span className="text-neutral-500">
                {" · "}
                {product.latest_quote.company_name}
                {" · "}
                {formatRelativeDate(product.latest_quote.created_at)}
              </span>
            </p>
          </div>
        )}
      </ModalBody>
      <ModalFooter className="justify-between">
        <Link href={`/empresario/produtos/editar/${product.id}`}>
          <Button variant="ghost" size="sm" type="button">
            <ExternalLink className="h-4 w-4" />
            Abrir edição completa
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {canUpdate ? "Cancelar" : "Fechar"}
          </Button>
          {canUpdate && (
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
