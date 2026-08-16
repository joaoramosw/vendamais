"use client";

import { assignProductCategories } from "@/actions/categories";
import { addProductQuote } from "@/actions/product-quotes";
import {
  createProduct,
  removeProductImage,
  updateProduct,
  uploadImageFromUrl,
  uploadProductImage,
} from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Textarea } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { showToast } from "@/components/ui/toast";
import {
  ACCEPTED_IMAGE_TYPES,
  compressImage,
  isAcceptedImageFile,
  isValidImageUrl,
} from "@/lib/image-utils";
import { checkPermission } from "@/lib/roles";
import type { Product, ProductQuote, UserRole } from "@/lib/types/database";
import { centsToDecimal, cn, decimalToCents, formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  ImageIcon,
  Link2,
  Loader2,
  Plus,
  Save,
  ScanBarcode,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { BarcodeScanner } from "./BarcodeScanner";

// ─── Tipos de progresso ───────────────────────────────────────────────────────
type UploadStage = "idle" | "compressing" | "uploading" | "done" | "error";

interface UploadState {
  stage: UploadStage;
  progress: number; // 0–100
  message: string;
}

const IDLE_STATE: UploadState = { stage: "idle", progress: 0, message: "" };

// ─── Componente de barra de progresso ────────────────────────────────────────
function UploadProgress({ state }: { state: UploadState }) {
  if (state.stage === "idle") return null;

  const colorClass =
    state.stage === "error"
      ? "bg-danger-500"
      : state.stage === "done"
        ? "bg-success-500"
        : "bg-primary-500";

  return (
    <div className="space-y-1.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {state.message}
        </span>
        {state.stage === "done" && (
          <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
        )}
        {state.stage === "error" && (
          <X className="h-3.5 w-3.5 text-danger-400" />
        )}
        {(state.stage === "compressing" || state.stage === "uploading") && (
          <Loader2 className="h-3.5 w-3.5 text-primary-400 animate-spin" />
        )}
      </div>
      <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${state.progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ProductFormProps {
  product?: Product & { quotes?: ProductQuote[] };
  userRole: UserRole;
  categories: { id: string; name: string; color: string }[];
  initialCategoryIds?: string[];
}

export function ProductForm({
  product,
  userRole,
  categories,
  initialCategoryIds = [],
}: ProductFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = !!product;
  const canUpdate = checkPermission(userRole, "update");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [barcode, setBarcode] = useState(
    product?.barcode ?? searchParams.get("barcode") ?? ""
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialCategoryIds);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRemoveImageConfirm, setShowRemoveImageConfirm] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(
    product?.image_url ?? null
  );
  const [uploadState, setUploadState] = useState<UploadState>(IDLE_STATE);
  // Preço unitário loja — armazenado em centavos para evitar float
  const [priceUnitStoreCents, setPriceUnitStoreCents] = useState(
    decimalToCents(product?.price_unit_store ?? 0)
  );

  // Quote state
  const [quoteCompany, setQuoteCompany] = useState("");
  const [quotePriceCents, setQuotePriceCents] = useState(0); // centavos, maquininha
  const [addingQuote, setAddingQuote] = useState(false);

  const isUploading =
    uploadState.stage === "compressing" || uploadState.stage === "uploading";

  // ─── Submit do formulário ─────────────────────────────────────────────────
  const handleSubmit = async () => {
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
      formData.set("category", categories.find(c => selectedCategoryIds.includes(c.id))?.name ?? "");
      formData.set("image_url", imageUrl);
      formData.set("price_unit_store", String(centsToDecimal(priceUnitStoreCents)));

      if (isEditing && product) {
        const result = await updateProduct(product.id, formData);
        if (result.error) {
          showToast(result.error, "error");
        } else {
          showToast("Produto atualizado com sucesso!", "success");
          await assignProductCategories(product.id, selectedCategoryIds);
          router.push("/empresario/produtos");
        }
      } else {
        const result = await createProduct(formData);
        if (result.error) {
          showToast(result.error, "error");
        } else {
          showToast("Produto criado com sucesso!", "success");
          if (result.productId) {
            await assignProductCategories(result.productId, selectedCategoryIds);
          }
          router.push("/empresario/produtos");
        }
      }
    } catch {
      showToast("Erro ao salvar produto.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmedSubmit = () => {
    setShowConfirm(false);
    handleSubmit();
  };

  // ─── Upload de arquivo ────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Valida tipo antes de tudo
    if (!isAcceptedImageFile(file)) {
      showToast(
        `Tipo não suportado: ${file.type || "desconhecido"}. Use JPG, PNG, WebP ou AVIF.`,
        "warning"
      );
      return;
    }

    // Preview imediato via Object URL — sem base64, sem pressão de memória
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    try {
      // Etapa 1: Compressão
      setUploadState({ stage: "compressing", progress: 10, message: "Comprimindo imagem…" });

      const compressed = await compressImage(file, 1200, 0.80, (pct) => {
        // pct vai de 5 a 95 dentro do compressImage
        const mapped = Math.round(10 + pct * 0.4); // mapeia para 10-50%
        setUploadState({ stage: "compressing", progress: mapped, message: "Comprimindo imagem…" });
      });

      setUploadState({ stage: "uploading", progress: 55, message: "Enviando para o servidor…" });

      const ext = compressed.type === "image/avif" ? "avif" : "webp";
      const compressedFile = new File(
        [compressed],
        `upload.${ext}`,
        { type: compressed.type }
      );

      const formData = new FormData();
      formData.set("file", compressedFile);
      if (product?.id) formData.set("productId", product.id);

      setUploadState({ stage: "uploading", progress: 75, message: "Salvando no storage…" });

      const result = await uploadProductImage(formData);

      // Libera preview temporário
      URL.revokeObjectURL(previewUrl);

      if (result.error) {
        setUploadState({ stage: "error", progress: 100, message: result.error });
        showToast(result.error, "error");
        setImagePreview(null);
      } else if (result.url) {
        setUploadState({ stage: "done", progress: 100, message: "Imagem enviada com sucesso!" });
        setImageUrl(result.url);
        setImagePreview(result.url);
        // Limpa a barra após 2 segundos
        setTimeout(() => setUploadState(IDLE_STATE), 2000);
      }
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      setImagePreview(null);
      const msg = err instanceof Error ? err.message : "Erro ao processar imagem.";
      setUploadState({ stage: "error", progress: 100, message: msg });
      showToast(msg, "error");
    } finally {
      // Reseta o input para permitir re-upload do mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Upload por URL ───────────────────────────────────────────────────────
  const handleUrlSubmit = async () => {
    const url = imageUrlInput.trim();
    if (!url) return;

    if (!isValidImageUrl(url)) {
      showToast("URL inválida. Use https://...", "warning");
      return;
    }

    // Preview imediato da URL fornecida (enquanto faz upload)
    setImagePreview(url);
    setUploadState({ stage: "uploading", progress: 20, message: "Validando imagem…" });

    try {
      setUploadState({ stage: "uploading", progress: 45, message: "Baixando imagem do servidor…" });

      const result = await uploadImageFromUrl(url, product?.id ?? null);

      if (result.error) {
        setUploadState({ stage: "error", progress: 100, message: result.error });
        showToast(result.error, "error");
        setImagePreview(null);
      } else if (result.url) {
        setUploadState({ stage: "done", progress: 100, message: "Imagem salva no storage!" });
        setImageUrl(result.url);
        setImagePreview(result.url);
        setShowUrlInput(false);
        setImageUrlInput("");
        setTimeout(() => setUploadState(IDLE_STATE), 2000);
      }
    } catch {
      setUploadState({ stage: "error", progress: 100, message: "Erro ao processar URL." });
      showToast("Erro ao processar URL da imagem.", "error");
      setImagePreview(null);
    }
  };

  // ─── Remover imagem ───────────────────────────────────────────────────────
  const handleRemoveImage = async () => {
    setShowRemoveImageConfirm(false);

    if (isEditing && product?.id) {
      // Produto existente: remove do storage e banco
      setUploadState({ stage: "uploading", progress: 50, message: "Removendo imagem…" });
      const result = await removeProductImage(product.id);
      if (result.error) {
        setUploadState({ stage: "error", progress: 100, message: result.error });
        showToast(result.error, "error");
        return;
      }
      setUploadState({ stage: "done", progress: 100, message: "Imagem removida." });
      setTimeout(() => setUploadState(IDLE_STATE), 1500);
    }

    // Reseta estado local
    setImageUrl("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!isEditing) showToast("Imagem removida.", "info");
  };

  // ─── Cotação ──────────────────────────────────────────────────────────────
  const handleAddQuote = async () => {
    if (!product?.id) return;
    if (!quoteCompany.trim() || quotePriceCents === 0) {
      showToast("Preencha empresa e preço.", "warning");
      return;
    }

    setAddingQuote(true);
    try {
      const result = await addProductQuote(
        product.id,
        quoteCompany,
        centsToDecimal(quotePriceCents)
      );
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast("Cotação adicionada!", "success");
        setQuoteCompany("");
        setQuotePriceCents(0);
        router.refresh();
      }
    } catch {
      showToast("Erro ao adicionar cotação.", "error");
    } finally {
      setAddingQuote(false);
    }
  };

  const handleBarcodeDetected = (code: string) => {
    setBarcode(code);
    setShowScanner(false);
    showToast(`Código detectado: ${code}`, "success");
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/empresario/produtos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {isEditing
              ? "Atualize as informações do produto"
              : "Preencha os dados para cadastrar um novo produto"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <Input
                label="Nome do produto *"
                placeholder="Ex: Arroz Integral 5kg"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              {/* Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Código de barras
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="EAN-13, UPC..."
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="flex-1 border border-neutral-200 dark:border-neutral-600 rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setShowScanner((prev) => !prev)}
                      title="Escanear código"
                    >
                      <ScanBarcode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Categorias
                  </label>
                  {/* Selected chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                    {selectedCategoryIds.map((catId) => {
                      const cat = categories.find((c) => c.id === catId);
                      if (!cat) return null;
                      return (
                        <span
                          key={catId}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: cat.color || "#6366f1" }}
                        >
                          {cat.name}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCategoryIds((prev) =>
                                prev.filter((id) => id !== catId)
                              )
                            }
                            className="ml-0.5 hover:bg-white/20 rounded-full p-0.5 transition-colors cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  {/* Dropdown toggle */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={selectedCategoryIds.length > 0 ? "Adicionar mais..." : "Buscar ou selecionar categoria..."}
                      value={categorySearch}
                      onChange={(e) => {
                        setCategorySearch(e.target.value);
                        setCategoryDropdownOpen(true);
                      }}
                      onFocus={() => setCategoryDropdownOpen(true)}
                      className="w-full border border-neutral-200 dark:border-neutral-600 rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
                    />
                    {categoryDropdownOpen && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-neutral-900 border border-white/10 rounded-[var(--radius-md)] shadow-lg max-h-48 overflow-y-auto">
                        {categories
                          .filter(
                            (c) =>
                              !selectedCategoryIds.includes(c.id) &&
                              c.name.toLowerCase().includes(categorySearch.toLowerCase())
                          )
                          .map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setSelectedCategoryIds((prev) => [...prev, cat.id]);
                                setCategorySearch("");
                                setCategoryDropdownOpen(false);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
                            >
                              <div
                                className="h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color || "#6366f1" }}
                              />
                              {cat.name}
                            </button>
                          ))}
                        {categories.filter(
                          (c) =>
                            !selectedCategoryIds.includes(c.id) &&
                            c.name.toLowerCase().includes(categorySearch.toLowerCase())
                        ).length === 0 && (
                          <p className="px-3 py-2 text-xs text-neutral-500">
                            Nenhuma categoria encontrada.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <Textarea
                label="Descrição"
                placeholder="Descrição detalhada do produto..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              {/* Preço unitário loja */}
              <PriceInput
                label="Preço unitário loja *"
                cents={priceUnitStoreCents}
                onCentsChange={setPriceUnitStoreCents}
                placeholder="R$ 0,00"
              />

              {/* Barcode Scanner */}
              {showScanner && (
                <div className="animate-fade-in">
                  <BarcodeScanner
                    onDetected={handleBarcodeDetected}
                    onClose={() => setShowScanner(false)}
                  />
                </div>
              )}
            </CardBody>
          </Card>

          {/* Quotes Section (edit mode only) */}
          {isEditing && product && (
            <Card>
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Cotações
                </h3>
              </div>
              <CardBody className="space-y-4">
                {/* Add new quote */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="Empresa fornecedora"
                    value={quoteCompany}
                    onChange={(e) => setQuoteCompany(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !addingQuote && handleAddQuote()}
                    className="flex-1"
                  />
                  <div className="w-full sm:w-40">
                    <PriceInput
                      cents={quotePriceCents}
                      onCentsChange={setQuotePriceCents}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <Button
                    onClick={handleAddQuote}
                    loading={addingQuote}
                    disabled={!quoteCompany.trim() || quotePriceCents === 0}
                    size="md"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>

                {/* Quotes list */}
                {product.quotes && product.quotes.length > 0 ? (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                    {product.quotes.map((quote, i) => (
                      <div
                        key={quote.id}
                        className={cn(
                          "flex items-center justify-between py-3",
                          i === 0 && "pt-0"
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                            {quote.company_name}
                          </p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">
                            {formatDate(quote.created_at)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-bold",
                            i === 0
                              ? "text-success-600 dark:text-success-400"
                              : "text-neutral-500 dark:text-neutral-400"
                          )}
                        >
                          {formatCurrency(quote.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">
                    Nenhuma cotação registrada.
                  </p>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar - Image */}
        <div className="space-y-6">
          <Card>
            <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-700">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Imagem
              </h3>
            </div>
            <CardBody className="space-y-4">
              {/* Preview */}
              <div className="relative aspect-square rounded-[var(--radius-lg)] overflow-hidden bg-neutral-100 dark:bg-neutral-700/50 border-2 border-dashed border-neutral-200 dark:border-neutral-600">
                {imagePreview && imagePreview.length > 0 ? (
                  <>
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 300px"
                      unoptimized={imagePreview.startsWith("blob:") || imagePreview.startsWith("data:")}
                      onError={() => {
                        // Fallback: remove preview if image fails to load
                        setImagePreview(null);
                      }}
                    />
                    {/* Overlay de loading */}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                        <p className="text-xs text-white/80 text-center px-4">
                          {uploadState.message}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-neutral-400 dark:text-neutral-500">
                    <div className="h-16 w-16 rounded-full bg-neutral-200 dark:bg-neutral-600 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-neutral-300 dark:text-neutral-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Sem imagem</p>
                      <p className="text-xs mt-0.5">Faça upload ou cole uma URL</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Barra de progresso */}
              <UploadProgress state={uploadState} />

              {/* Botões de ação */}
              <div className={`grid ${imagePreview ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  loading={isUploading}
                  disabled={isUploading}
                  title="JPG, PNG, WebP, AVIF aceitos"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                />

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  disabled={isUploading}
                >
                  <Link2 className="h-4 w-4" />
                  URL
                </Button>

                {imagePreview && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowRemoveImageConfirm(true)}
                    disabled={isUploading}
                    className="text-danger-400 hover:text-danger-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>

              {/* Formatos aceitos */}
              <p className="text-xs text-neutral-400 dark:text-neutral-600 text-center">
                JPG · PNG · WebP · AVIF — máx. 20 MB
              </p>

              {/* Input de URL */}
              {showUrlInput && (
                <div className="space-y-2 animate-fade-in">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/imagem.jpg"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                      disabled={isUploading}
                      className="flex-1 border border-neutral-200 dark:border-neutral-600 rounded-[var(--radius-md)] px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all disabled:opacity-60"
                    />
                    <Button
                      size="sm"
                      onClick={handleUrlSubmit}
                      disabled={!imageUrlInput.trim() || isUploading}
                      loading={isUploading}
                    >
                      OK
                    </Button>
                  </div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed">
                    A imagem será baixada e armazenada no storage do sistema.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Save Button */}
          <div className="space-y-3">
            {canUpdate || !isEditing ? (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  loading={saving}
                  disabled={saving || isUploading}
                  onClick={() =>
                    isEditing ? setShowConfirm(true) : handleSubmit()
                  }
                >
                  <Save className="h-5 w-5" />
                  {isEditing ? "Salvar alterações" : "Criar produto"}
                </Button>
                <Link href="/empresario/produtos" className="block">
                  <Button variant="secondary" className="w-full">
                    Cancelar
                  </Button>
                </Link>
              </>
            ) : (
              <Link href="/empresario/produtos" className="block">
                <Button variant="secondary" className="w-full">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Dialog: confirmação de edição */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmedSubmit}
        title="Confirmar edição"
        description="Tem certeza que deseja salvar as alterações neste produto?"
        confirmLabel="Salvar"
        variant="warning"
        loading={saving}
      />

      {/* Dialog: confirmação de remoção de imagem */}
      <ConfirmDialog
        open={showRemoveImageConfirm}
        onClose={() => setShowRemoveImageConfirm(false)}
        onConfirm={handleRemoveImage}
        title="Remover imagem"
        description={
          isEditing
            ? "Tem certeza que deseja apagar esta imagem? Ela será removida do storage e essa ação não poderá ser desfeita."
            : "Tem certeza que deseja remover a imagem selecionada?"
        }
        confirmLabel="Apagar imagem"
        variant="danger"
      />
    </div>
  );
}
