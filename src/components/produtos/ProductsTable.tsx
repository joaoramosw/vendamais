"use client";

import {
  deleteProduct,
  deleteProductsBatch,
  duplicateProduct,
  getProductIdByBarcode,
  getProducts,
} from "@/actions/products";
import { normalizePerPage, PER_PAGE_OPTIONS, PER_PAGE_STORAGE_KEY } from "@/lib/pagination";
import { useInView } from "react-intersection-observer";
import { looksLikeBarcode } from "@/lib/barcode";
import { BarcodeScanner } from "@/components/produtos/BarcodeScanner";
import { StockModal, type StockProduct } from "@/components/produtos/StockModal";
import { ActionIconWrapper } from "@/components/ui/action-icon-wrapper";
import { CopiedIcon, EyeToggleIcon } from "@/components/ui/animated-state-icons";
import { Button } from "@/components/ui/button";
import {
  ColumnConfigModal,
  loadColumnLabels,
  loadColumnOrder,
  saveColumnLabels,
  saveColumnOrder,
  type ColumnDef,
} from "@/components/ui/column-config-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { showToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { useDraftList } from "@/lib/hooks/useDraftList";
import { PRODUCT_FEATURES, useProductFeatures } from "@/lib/hooks/useProductFeatures";
import { applySorting, useTableSort } from "@/lib/hooks/useTableSort";
import { checkPermission } from "@/lib/roles";
import type { ProductWithQuote, UserRole } from "@/lib/types/database";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";
import {
  ArrowUp,
  Camera,
  Check,
  Edit,
  Expand,
  Filter,
  ListCheck,
  ListMinus,
  ListPlus,
  Loader2,
  Package,
  Plus,
  Search,
  Settings2,
  Trash2,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BatchAddModal } from "./BatchAddModal";
import { BatchEditModal } from "./BatchEditModal";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { ProductQuickViewModal } from "./ProductQuickViewModal";

/* ─── Column definitions ─── */
const PRODUCT_COLUMNS: ColumnDef[] = [
  { id: "select", label: "Selecionar", fixed: true, renamable: false },
  { id: "imagem", label: "Imagem" },
  { id: "nome", label: "Nome" },
  { id: "categoria", label: "Categoria" },
  { id: "preco", label: "Preço" },
  { id: "cotacao", label: "Última Cotação" },
  { id: "acoes", label: "Ações", fixed: true },
];
const PRODUCT_DEFAULT_ORDER = PRODUCT_COLUMNS.map((c) => c.id);
const PRODUCT_COL_STORAGE_KEY = "vendamais_product_columns";
const DEFAULT_UNIT_STORAGE_KEY = "vendamais_default_unit";

function _loadDefaultUnit(): string {
  if (typeof window === "undefined") return "CX";
  try {
    return localStorage.getItem(DEFAULT_UNIT_STORAGE_KEY) || "CX";
  } catch {
    return "CX";
  }
}

/* ─── Styled Checkbox ─── */
function StyledCheckbox({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: () => void;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`
        relative h-[18px] w-[18px] rounded-md border-2 transition-all duration-200 cursor-pointer flex items-center justify-center
        ${
          checked
            ? "bg-primary-500 border-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
            : "bg-transparent border-white/20 hover:border-white/40"
        }
      `}
    >
      {checked && (
        <Check className="h-3 w-3 text-white animate-check-pop" strokeWidth={3} />
      )}
    </button>
  );
}

/* ─── Sort label helper ─── */
const SORT_HINT: Record<string, { asc: string; desc: string }> = {
  nome:      { asc: "A → Z",  desc: "Z → A" },
  categoria: { asc: "A → Z",  desc: "Z → A" },
  preco:     { asc: "$ ↑",    desc: "$ ↓" },
  cotacao:   { asc: "$ ↑",    desc: "$ ↓" },
};

/* ─── Skeleton Row ─── */
function SkeletonRow({ cols }: { cols: number }) {
  return (
    <TableRow>
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}>
          <div
            className="h-4 rounded bg-neutral-200 dark:bg-white/[0.06] animate-pulse"
            style={{ width: `${50 + ((i * 17) % 40)}%` }}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

interface ProductsTableProps {
  products: ProductWithQuote[];
  total: number;
  categories: { id: string; name: string; slug: string; color: string }[];
  userRole: UserRole;
  perPage: number;
  /** A URL trouxe `perPage` explícito? Se não, vale a preferência salva. */
  perPageFromUrl: boolean;
  filters: {
    search?: string;
    category?: string;
    barcode?: string;
    dateFrom?: string;
    dateTo?: string;
    priceMin?: string;
    priceMax?: string;
  };
}

export function ProductsTable({
  products,
  total,
  categories,
  userRole,
  perPage,
  perPageFromUrl,
  filters,
}: ProductsTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Acesso rápido — edita os campos principais sem sair da listagem.
  const [quickViewProduct, setQuickViewProduct] = useState<ProductWithQuote | null>(null);
  const draftList = useDraftList();
  const [isNavigating, startTransition] = useTransition();
  const { features, isEnabled, setFeatures } = useProductFeatures();

  /* ─── Carregamento dinâmico ───
   * O servidor entrega só o primeiro lote; o resto é anexado conforme o
   * usuário rola. `products` só muda de identidade quando o servidor
   * re-renderiza (filtro, perPage, router.refresh), que é exatamente quando a
   * lista acumulada precisa ser descartada. */
  const [items, setItems] = useState<ProductWithQuote[]>(products);
  const [loadedPages, setLoadedPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [endReached, setEndReached] = useState(false);

  useEffect(() => {
    setItems(products);
    setLoadedPages(1);
    setLoadError(null);
    setEndReached(false);
  }, [products]);

  // `total` vem da contagem do banco, mas o filtro de preço é aplicado depois
  // da paginação (ver getProducts) — com ele ativo a conta nunca fecha. Por
  // isso um lote que não traz nada novo também encerra a lista, senão o
  // observer ficaria pedindo página pra sempre.
  const hasMore = !endReached && items.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const proximaPagina = loadedPages + 1;
      const { products: novos } = await getProducts({
        ...filters,
        page: proximaPagina,
        perPage,
      });
      if (novos.length === 0) {
        setEndReached(true);
        return;
      }
      setItems((prev) => {
        // A página pode ter mudado no servidor entre um lote e outro
        // (produto criado/excluído por outra aba) — dedupe por id evita
        // linha repetida e o erro de key duplicada do React.
        const vistos = new Set(prev.map((p) => p.id));
        return [...prev, ...novos.filter((p) => !vistos.has(p.id))];
      });
      setLoadedPages(proximaPagina);
    } catch {
      setLoadError("Não foi possível carregar mais produtos.");
    } finally {
      setLoadingMore(false);
    }
  }, [filters, hasMore, loadedPages, loadingMore, perPage]);

  // Sentinela: dispara antes de o usuário chegar no fim, pra a lista parecer
  // contínua em vez de dar um solavanco no rodapé.
  const { ref: sentinelRef, inView } = useInView({ rootMargin: "400px" });

  useEffect(() => {
    if (inView && hasMore && !loadingMore && !loadError) loadMore();
  }, [inView, hasMore, loadingMore, loadError, loadMore]);

  /** Carimba o tamanho do lote em toda navegação da listagem — sem isso,
   * buscar ou filtrar joga a escolha do usuário de volta pro padrão. */
  const withPerPage = useCallback(
    (params: URLSearchParams, valor: number = perPage) => {
      params.set("perPage", String(valor));
      params.delete("page");
      return params.toString();
    },
    [perPage],
  );

  const handlePerPageChange = (value: number) => {
    try {
      localStorage.setItem(PER_PAGE_STORAGE_KEY, String(value));
    } catch {
      // Sem localStorage a escolha só não persiste entre visitas.
    }
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.category) params.set("category", filters.category);
    if (filters.barcode) params.set("barcode", filters.barcode);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.priceMin) params.set("priceMin", filters.priceMin);
    if (filters.priceMax) params.set("priceMax", filters.priceMax);
    startTransition(() => router.push(`/empresario/produtos?${withPerPage(params, value)}`));
  };

  // Retoma o tamanho de lote escolhido numa visita anterior. A URL é a fonte de
  // verdade (é dela que o servidor lê), então a preferência salva só entra
  // quando a URL não diz nada.
  useEffect(() => {
    if (perPageFromUrl) return;
    let salvo: string | null = null;
    try {
      salvo = localStorage.getItem(PER_PAGE_STORAGE_KEY);
    } catch {
      return;
    }
    if (!salvo) return;
    const preferido = normalizePerPage(salvo);
    if (preferido === perPage) return;
    const params = new URLSearchParams(window.location.search);
    router.replace(`/empresario/produtos?${withPerPage(params, preferido)}`);
  }, [perPageFromUrl, perPage, router, withPerPage]);

  // Stock modal state
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalProducts, setStockModalProducts] = useState<StockProduct[]>([]);

  // Duplicate warning modal state
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateProductIds, setDuplicateProductIds] = useState<string[]>([]);

  // Column config
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    loadColumnOrder(PRODUCT_COL_STORAGE_KEY, PRODUCT_DEFAULT_ORDER)
  );
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>(() =>
    loadColumnLabels(PRODUCT_COL_STORAGE_KEY)
  );

  // Barcode scanner
  const [showScanner, setShowScanner] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Default unit (read from localStorage, synced with DraftListClient)
  const [defaultUnit] = useState<string>(() => _loadDefaultUnit());

  // Filter state
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [categoryFilter, setCategoryFilter] = useState(filters.category ?? "");
  const [barcodeFilter, setBarcodeFilter] = useState(filters.barcode ?? "");
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");
  const [priceMin, setPriceMin] = useState(filters.priceMin ?? "");
  const [priceMax, setPriceMax] = useState(filters.priceMax ?? "");

  const canCreate = checkPermission(userRole, "create");
  const canUpdate = checkPermission(userRole, "update");
  const canDelete = checkPermission(userRole, "delete");
  const canBatchEdit = checkPermission(userRole, "batch_edit");
  const podeSelecionar = (canUpdate || canDelete) && isEnabled("selecaoMultipla");

  // Saída de emergência: se o usuário desligar o botão Configurações, este é o
  // único caminho de volta pra tela de configurações.
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.key.toLowerCase() !== "c") return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      if (alvo?.isContentEditable) return;
      setShowColumnConfig(true);
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  const allSelected =
    items.length > 0 && items.every((p) => selectedIds.has(p.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((p) => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ─── Seleção por Ctrl + clique / Ctrl + arrastar ───
   * Estilo galeria de fotos: segurar Ctrl (⌘ no Mac) e arrastar sobre as
   * linhas marca o intervalo. `base` guarda a seleção de antes do arrasto pra
   * que voltar com o mouse desfaça o que passou — sem isso, arrastar pra trás
   * deixaria linhas marcadas por engano. */
  const dragSelectRef = useRef<{
    anchor: number;
    mode: "add" | "remove";
    base: Set<string>;
  } | null>(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);

  const applySelectionRange = useCallback(
    (from: number, to: number, visiveis: ProductWithQuote[]) => {
      const info = dragSelectRef.current;
      if (!info) return;
      const [ini, fim] = from <= to ? [from, to] : [to, from];
      const alvo = visiveis.slice(ini, fim + 1).map((p) => p.id);
      const next = new Set(info.base);
      for (const id of alvo) {
        if (info.mode === "add") next.add(id);
        else next.delete(id);
      }
      setSelectedIds(next);
    },
    [],
  );

  useEffect(() => {
    if (!isDragSelecting) return;
    const encerrar = () => {
      dragSelectRef.current = null;
      setIsDragSelecting(false);
    };
    window.addEventListener("mouseup", encerrar);
    return () => window.removeEventListener("mouseup", encerrar);
  }, [isDragSelecting]);

  /* ─── Sorting ─── */
  const { sortCriteria, toggleSort, getSortDirection, getSortIndex } = useTableSort();

  const getProductSortField = useCallback(
    (product: ProductWithQuote, column: string): string | number | null | undefined => {
      switch (column) {
        case "nome": return product.name;
        case "categoria": return product.category;
        case "preco": return product.price_unit_store;
        case "cotacao": return product.latest_quote?.price ?? null;
        default: return null;
      }
    },
    []
  );

  /* ─── Client-side instant filtering + sorting (memoized) ─── */
  const displayProducts = useMemo(() => {
    const lowerSearch = searchInput.toLowerCase().trim();
    const filtered = lowerSearch
      ? items.filter(
          (p) =>
            p.name.toLowerCase().includes(lowerSearch) ||
            (p.barcode ?? "").toLowerCase().includes(lowerSearch)
        )
      : items;

    return applySorting(filtered, sortCriteria, getProductSortField);
  }, [items, searchInput, sortCriteria, getProductSortField]);

  /* ─── Debounced server-side search (triggers after 500ms of typing) ─── */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only trigger server-side search if the user changed the search input
    // and it differs from the current server-side filter
    if (searchInput === (filters.search ?? "")) { setIsDebouncing(false); return; }
    setIsDebouncing(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setIsDebouncing(false);
      const q = searchInput.trim();
      if (!q) {
        // Clear search
        if (filters.search) {
          const params = new URLSearchParams();
          if (categoryFilter) params.set("category", categoryFilter);
          if (barcodeFilter) params.set("barcode", barcodeFilter);
          if (dateFrom) params.set("dateFrom", dateFrom);
          if (dateTo) params.set("dateTo", dateTo);
          if (priceMin) params.set("priceMin", priceMin);
          if (priceMax) params.set("priceMax", priceMax);
          params.set("page", "1");
          startTransition(() => router.push(`/empresario/produtos?${withPerPage(params)}`));
        }
        return;
      }
      if (looksLikeBarcode(q)) {
        const params = new URLSearchParams();
        params.set("barcode", q);
        params.set("page", "1");
        startTransition(() => router.push(`/empresario/produtos?${withPerPage(params)}`));
      } else {
        const params = new URLSearchParams();
        params.set("search", q);
        if (categoryFilter) params.set("category", categoryFilter);
        if (barcodeFilter) params.set("barcode", barcodeFilter);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (priceMin) params.set("priceMin", priceMin);
        if (priceMax) params.set("priceMax", priceMax);
        params.set("page", "1");
        router.push(`/empresario/produtos?${withPerPage(params)}`);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (searchInput) params.set("search", searchInput);
    if (categoryFilter) params.set("category", categoryFilter);
    if (barcodeFilter) params.set("barcode", barcodeFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (priceMin) params.set("priceMin", priceMin);
    if (priceMax) params.set("priceMax", priceMax);
    router.push(`/empresario/produtos?${withPerPage(params)}`);
  }, [searchInput, categoryFilter, barcodeFilter, dateFrom, dateTo, priceMin, priceMax, router, withPerPage]);

  const handleBarcodeLookup = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const { productId } = await getProductIdByBarcode(trimmed);

    if (productId) {
      router.push(`/empresario/produtos/editar/${productId}`);
    } else {
      showToast("Produto não encontrado. Abrindo cadastro de produto...", "warning");
      router.push(`/empresario/produtos/novo?barcode=${encodeURIComponent(trimmed)}`);
    }
  }, [router]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const q = searchInput.trim();
    if (looksLikeBarcode(q)) {
      // Código de barras: abre direto o produto (ou o cadastro, se não achar)
      handleBarcodeLookup(q);
    } else {
      applyFilters();
    }
  }, [searchInput, applyFilters, handleBarcodeLookup]);

  const handleBarcodeDetected = (code: string) => {
    setShowScanner(false);
    handleBarcodeLookup(code);
  };

  const clearFilters = () => {
    setSearchInput("");
    setCategoryFilter("");
    setBarcodeFilter("");
    setDateFrom("");
    setDateTo("");
    setPriceMin("");
    setPriceMax("");
    router.push(`/empresario/produtos?${withPerPage(new URLSearchParams())}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const result = await deleteProduct(deleteId);
      if (result.error) {
        showToast(result.error, "error");
      } else {
        // Remove from draft list if present
        if (draftList.hasItem(deleteId)) {
          draftList.removeItem(deleteId);
        }
        showToast("Produto excluído com sucesso!", "success");
        router.refresh();
      }
    } catch {
      showToast("Erro ao excluir produto.", "error");
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchDeleteLoading(true);
    try {
      const result = await deleteProductsBatch(Array.from(selectedIds));
      if (result.error) {
        showToast(result.error, "error");
      } else {
        // Remove from draft list if present
        selectedIds.forEach((id) => {
          if (draftList.hasItem(id)) draftList.removeItem(id);
        });
        showToast(`${selectedIds.size} ${selectedIds.size === 1 ? 'produto excluído' : 'produtos excluídos'} com sucesso!`, "success");
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch {
      showToast("Erro ao excluir produtos em lote.", "error");
    } finally {
      setBatchDeleteLoading(false);
      setShowBatchDeleteConfirm(false);
    }
  };

  /* ─── Add to draft with stock modal ─── */
  const handleBatchAddToDraft = () => {
    const toAdd = items.filter((p) => selectedIds.has(p.id));
    const newItems: StockProduct[] = [];
    const alreadyInList: string[] = [];

    toAdd.forEach((p) => {
      if (draftList.hasItem(p.id)) {
        alreadyInList.push(p.id);
      } else {
        newItems.push({
          id: p.id,
          name: p.name,
          image_url: p.image_url,
          barcode: p.barcode,
        });
      }
    });

    if (newItems.length > 0) {
      // Open stock modal for new items
      setStockModalProducts(newItems);
      setShowStockModal(true);
    } else if (alreadyInList.length > 0) {
      // All items already in the list — show removal option
      setDuplicateProductIds(alreadyInList);
      setShowDuplicateWarning(true);
    }

    setSelectedIds(new Set());
  };

  const handleStockConfirm = (stockMap: Record<string, number>) => {
    Object.entries(stockMap).forEach(([productId, estoque]) => {
      const product = items.find((p) => p.id === productId);
      if (!product) return;
      draftList.addItem({
        productId: product.id,
        nome: product.name,
        foto: product.image_url ?? null,
        codigoBarras: product.barcode ?? null,
        categoria: product.category ?? null,
        precoAtual: product.price_unit_store > 0 ? product.price_unit_store : null,
        estoque,
        // Zero = campo vazio na lista de cotação ("clique para preencher").
        // O envio já barra item sem quantidade, então é melhor pedir o número
        // do que mandar um "1" que ninguém decidiu.
        quantidadeSugerida: 0,
        tipoUnidade: defaultUnit as "UN" | "CX" | "DZ" | "FD",
      });
    });
    setShowStockModal(false);
    setStockModalProducts([]);
    showToast(`${Object.keys(stockMap).length} produto(s) adicionado(s) à lista de cotação.`, "success");
  };

  const handleSingleAddToDraft = (product: ProductWithQuote) => {
    if (draftList.hasItem(product.id)) {
      draftList.removeItem(product.id);
      showToast("Removido da lista de cotação.", "info");
    } else {
      setStockModalProducts([{
        id: product.id,
        name: product.name,
        image_url: product.image_url,
        barcode: product.barcode,
      }]);
      setShowStockModal(true);
    }
  };

  /* ─── Remove from draft in batch ─── */
  const handleBatchRemoveFromDraft = () => {
    const toRemove = items.filter((p) => selectedIds.has(p.id) && draftList.hasItem(p.id));
    if (toRemove.length === 0) {
      showToast("Nenhum dos selecionados está na lista de cotação.", "info");
      return;
    }
    toRemove.forEach((p) => draftList.removeItem(p.id));
    showToast(`${toRemove.length} produto(s) removido(s) da lista de cotação.`, "success");
    setSelectedIds(new Set());
  };

  /* ─── Handle duplicate removal ─── */
  const handleRemoveDuplicates = () => {
    duplicateProductIds.forEach((id) => draftList.removeItem(id));
    showToast(`${duplicateProductIds.length} produto(s) removido(s) da lista.`, "success");
    setDuplicateProductIds([]);
    setShowDuplicateWarning(false);
  };

  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id);
    try {
      const result = await duplicateProduct(id);
      if (result.error) {
        showToast(result.error, "error");
      } else if (result.productId) {
        showToast("Produto duplicado com sucesso!", "success");
        router.push(`/empresario/produtos/editar/${result.productId}`);
      }
    } catch {
      showToast("Erro ao duplicar produto.", "error");
    } finally {
      setDuplicatingId(null);
    }
  };

  /* ─── Column config ─── */
  const handleSaveColumnOrder = useCallback((newOrder: string[]) => {
    setColumnOrder(newOrder);
    saveColumnOrder(PRODUCT_COL_STORAGE_KEY, newOrder);
  }, []);

  const handleSaveColumnLabels = useCallback((newLabels: Record<string, string>) => {
    setColumnLabels(newLabels);
    saveColumnLabels(PRODUCT_COL_STORAGE_KEY, newLabels);
  }, []);

  const hasActiveFilters = !!(
    filters.search ||
    filters.category ||
    filters.barcode ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.priceMin ||
    filters.priceMax
  );

  // Check how many selected items are in draft list
  const selectedInDraft = items.filter((p) => selectedIds.has(p.id) && draftList.hasItem(p.id)).length;

  /* ─── Get delete description with draft warning ─── */
  const getDeleteDescription = () => {
    if (!deleteId) return "";
    if (draftList.hasItem(deleteId)) {
      return "⚠️ Este produto está na sua Lista de Cotação. Excluí-lo também o removerá de lá. Tem certeza que deseja excluir? Esta ação não pode ser desfeita.";
    }
    return "Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.";
  };

  /* ─── Dynamic column rendering ─── */
  const renderHeaderCell = (colId: string) => {
    switch (colId) {
      case "select":
        return (canUpdate || canDelete) ? (
          <TableHead key={colId} className="w-12">
            <StyledCheckbox
              checked={allSelected}
              onChange={toggleAll}
              id="select-all-products"
            />
          </TableHead>
        ) : null;
      case "imagem":
        return <TableHead key={colId} className="w-20">{columnLabels.imagem ?? "Imagem"}</TableHead>;
      case "nome":
      case "categoria":
      case "preco":
      case "cotacao": {
        const defaultLabel = { nome: "Nome", categoria: "Categoria", preco: "Preço", cotacao: "Última Cotação" }[colId];
        const label = columnLabels[colId] ?? defaultLabel;
        const width = { nome: undefined, categoria: "w-32", preco: "w-44", cotacao: "w-44" }[colId];
        const dir = getSortDirection(colId);
        const idx = getSortIndex(colId);
        const hint = SORT_HINT[colId];
        return (
          <TableHead key={colId} className={width}>
            <button
              type="button"
              onClick={() => toggleSort(colId)}
              className="flex items-center gap-1.5 text-inherit hover:text-primary-400 transition-colors cursor-pointer select-none w-full group/sort"
            >
              {label}
              {dir && hint && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-500/15 text-primary-400 whitespace-nowrap">
                  {dir === "asc" ? hint.asc : hint.desc}
                </span>
              )}
              {!dir && (
                <ArrowUp className="h-3 w-3 text-neutral-600 opacity-0 group-hover/sort:opacity-100 transition-opacity" />
              )}
              {dir && sortCriteria.length > 1 && (
                <span className="text-[9px] text-primary-400/60 font-bold">{idx}</span>
              )}
            </button>
          </TableHead>
        );
      }
      case "acoes":
        return <TableHead key={colId} className="w-28">{columnLabels.acoes ?? "Ações"}</TableHead>;
      default:
        return null;
    }
  };

  const renderBodyCell = (colId: string, product: ProductWithQuote) => {
    switch (colId) {
      case "select":
        return (canUpdate || canDelete) ? (
          <TableCell key={colId} onClick={(e) => e.stopPropagation()}>
            <StyledCheckbox
              checked={selectedIds.has(product.id)}
              onChange={() => toggleOne(product.id)}
            />
          </TableCell>
        ) : null;
      case "imagem":
        return (
          <TableCell key={colId} onClick={(e) => e.stopPropagation()}>
            {product.image_url ? (
              <button
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) return;
                  setPreviewImage({ url: product.image_url!, name: product.name });
                }}
                className="relative h-[60px] w-[60px] rounded-[var(--radius-md)] overflow-hidden bg-neutral-100 dark:bg-white/[0.06] hover:ring-2 hover:ring-primary-400 transition-all cursor-pointer group/img"
              >
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform group-hover/img:scale-110"
                  sizes="60px"
                />
              </button>
            ) : (
              <div className="h-[60px] w-[60px] rounded-[var(--radius-md)] bg-neutral-50 dark:bg-white/[0.04] border border-dashed border-neutral-200 dark:border-white/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-neutral-600" />
              </div>
            )}
          </TableCell>
        );
      case "nome":
        // Nome e ícone de expandir fazem a mesma coisa: abrem o acesso rápido.
        // A edição completa fica no botão da coluna Ações.
        return (
          <TableCell key={colId}>
            <div className="flex items-start gap-1.5">
              <Tooltip label="Acesso rápido" className="min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    // Ctrl/⌘ é seleção múltipla, não abre o acesso rápido.
                    if (e.ctrlKey || e.metaKey) return;
                    setQuickViewProduct(product);
                  }}
                  aria-label={`Acesso rápido: ${product.name}`}
                  className="text-left min-w-0 cursor-pointer"
                >
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-primary-400 transition-colors line-clamp-2 max-w-[220px] block">
                    {product.name}
                  </span>
                  {product.barcode && (
                    <span className="text-xs text-neutral-500 mt-0.5 block font-mono">
                      {product.barcode}
                    </span>
                  )}
                </button>
              </Tooltip>
              <Tooltip label="Acesso rápido" className="shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.ctrlKey || e.metaKey) return;
                    setQuickViewProduct(product);
                  }}
                  aria-label={`Acesso rápido: ${product.name}`}
                  className="p-1 rounded-[var(--radius-md)] text-neutral-400 dark:text-neutral-600 hover:text-primary-400 hover:bg-primary-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
                >
                  <Expand className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </div>
          </TableCell>
        );
      case "categoria":
        return (
          <TableCell key={colId}>
            <div className="flex flex-wrap gap-1">
              {(product.categories && product.categories.length > 0) ? (
                product.categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white whitespace-nowrap"
                    style={{ backgroundColor: cat.color || '#6366f1' }}
                  >
                    {cat.name}
                  </span>
                ))
              ) : (
                <span className="text-neutral-600 italic text-xs">—</span>
              )}
            </div>
          </TableCell>
        );
      case "preco":
        return (
          <TableCell key={colId}>
            {product.price_unit_store > 0 ? (
              <span className="text-sm font-semibold text-neutral-200 whitespace-nowrap">
                {formatCurrency(product.price_unit_store)}
              </span>
            ) : (
              <span className="text-neutral-600 text-xs italic">—</span>
            )}
          </TableCell>
        );
      case "cotacao":
        return (
          <TableCell key={colId}>
            {product.latest_quote ? (
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-success-400 whitespace-nowrap">
                  {formatCurrency(product.latest_quote.price)}
                </p>
                <p className="text-xs text-neutral-400 truncate max-w-[150px]">
                  {product.latest_quote.company_name}
                </p>
                <p className="text-[11px] text-neutral-600">
                  {formatRelativeDate(product.latest_quote.created_at)}
                </p>
              </div>
            ) : (
              <span className="text-neutral-600 text-xs italic">Sem cotação</span>
            )}
          </TableCell>
        );
      case "acoes":
        return (
          <TableCell
            key={colId}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1">
              <Tooltip label={canUpdate ? "Edição completa" : "Ver detalhes"}>
                <Link href={`/empresario/produtos/editar/${product.id}`}>
                  <button
                    className="p-1.5 rounded-[var(--radius-md)] text-neutral-500 hover:text-primary-400 hover:bg-primary-500/10 transition-colors cursor-pointer"
                    aria-label={canUpdate ? "Edição completa" : "Ver detalhes"}
                  >
                    {canUpdate ? (
                      <Edit className="h-4 w-4" />
                    ) : (
                      <EyeToggleIcon size={16} className="h-4 w-4" isActive={false} />
                    )}
                  </button>
                </Link>
              </Tooltip>
              {canCreate && (
                duplicatingId === product.id ? (
                  <button className="p-1.5 rounded-[var(--radius-md)] text-warning-400 disabled:opacity-50 cursor-not-allowed">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </button>
                ) : (
                  <Tooltip label="Duplicar produto">
                    <ActionIconWrapper
                      icon={CopiedIcon}
                      onClick={() => handleDuplicate(product.id)}
                      size={16}
                      className="h-4 w-4 text-inherit"
                      wrapperClassName="p-1.5 rounded-[var(--radius-md)] text-neutral-500 hover:text-warning-400 hover:bg-warning-500/10 transition-colors cursor-pointer"
                    />
                  </Tooltip>
                )
              )}
              {canDelete && (
                <Tooltip label="Excluir produto">
                  <button
                    onClick={() => setDeleteId(product.id)}
                    aria-label="Excluir produto"
                    className="p-1.5 rounded-[var(--radius-md)] text-neutral-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
              <Tooltip
                label={
                  draftList.hasItem(product.id)
                    ? "Remover da lista de cotação"
                    : "Adicionar à lista de cotação"
                }
              >
                <button
                  onClick={() => handleSingleAddToDraft(product)}
                  aria-label={
                    draftList.hasItem(product.id)
                      ? "Remover da lista de cotação"
                      : "Adicionar à lista de cotação"
                  }
                  className={`p-1.5 rounded-[var(--radius-md)] transition-colors cursor-pointer ${
                    draftList.hasItem(product.id)
                      ? "text-success-400 hover:text-success-300 hover:bg-success-500/10"
                      : "text-neutral-500 hover:text-primary-400 hover:bg-primary-500/10"
                  }`}
                >
                  {draftList.hasItem(product.id) ? (
                    <ListCheck className="h-4 w-4" />
                  ) : (
                    <ListPlus className="h-4 w-4" />
                  )}
                </button>
              </Tooltip>
            </div>
          </TableCell>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho da tela — Configurações fica aqui, à direita, antes do total */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            Produtos
          </h1>
          <p className="text-neutral-400 font-medium mt-1">
            Gerencie seu catálogo de produtos, cotações e códigos de barras.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1.5 shrink-0">
          {isEnabled("configuracoes") && (
            <Tooltip label="Colunas e funcionalidades da tela">
              <Button variant="secondary" size="sm" onClick={() => setShowColumnConfig(true)}>
                <Settings2 className="h-4 w-4" />
                Configurações
              </Button>
            </Tooltip>
          )}
          <span className="text-xs font-bold text-neutral-500 bg-white/[0.04] border border-white/[0.06] px-3 py-1 rounded-full">
            {total.toLocaleString("pt-BR")} {total === 1 ? "produto" : "produtos"}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          {/* Search */}
          {isEnabled("busca") && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar por nome ou cód. barras..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-9 pr-9 py-2.5 text-sm border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
              />
              {(isDebouncing || isNavigating) && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400 animate-spin" />
              )}
            </div>
          )}

          {isEnabled("escanear") && (
            <Tooltip label="Ler código de barras pela câmera">
              <Button
                variant={showScanner ? "primary" : "secondary"}
                size="sm"
                onClick={() => setShowScanner((prev) => !prev)}
              >
                <Camera className="h-4 w-4" />
                Escanear
              </Button>
            </Tooltip>
          )}

          {isEnabled("filtros") && (
            <Tooltip label="Filtrar por categoria, data e preço">
              <Button
                variant={showFilters ? "primary" : "secondary"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
                Filtros
              </Button>
            </Tooltip>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-primary-400"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size >= 1 && canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBatchDeleteConfirm(true)}
              className="text-danger-400 hover:text-danger-300 hover:bg-danger-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Excluir {selectedIds.size}
            </Button>
          )}
          {selectedIds.size >= 1 && selectedInDraft > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBatchRemoveFromDraft}
              className="text-warning-400 hover:text-warning-300 hover:bg-warning-500/10"
            >
              <ListMinus className="h-4 w-4" />
              - Lista ({selectedInDraft})
            </Button>
          )}
          {selectedIds.size >= 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBatchAddToDraft}
              className="text-primary-400 hover:text-primary-300 hover:bg-primary-500/10"
            >
              <ListPlus className="h-4 w-4" />
              + Lista ({selectedIds.size})
            </Button>
          )}
          {selectedIds.size >= 2 && canBatchEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBatchEdit(true)}
            >
              <Edit className="h-4 w-4" />
              Editar {selectedIds.size} selecionado(s)
            </Button>
          )}
          {canCreate && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowBatchAdd(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar em lote
              </Button>
              <Link href="/empresario/produtos/novo">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Novo Produto
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Scanner */}
      {showScanner && isEnabled("escanear") && (
        <div className="animate-fade-in">
          <BarcodeScanner
            onDetected={handleBarcodeDetected}
            onClose={() => setShowScanner(false)}
          />
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && isEnabled("filtros") && (
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/[0.06] rounded-[var(--radius-lg)] p-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-400">
                Categoria
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] px-3 py-2 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
              >
                <option value="">Todas</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-400">
                Data início
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] px-3 py-2 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-400">
                Data fim
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] px-3 py-2 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-400">
                Preço mín. (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="w-full border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] px-3 py-2 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-400">
                Preço máx. (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-full border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] px-3 py-2 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
            <Button size="sm" onClick={applyFilters}>
              Aplicar filtros
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/[0.06] rounded-[var(--radius-lg)] overflow-hidden shadow-xs">
        <div className={`overflow-x-auto ${isDragSelecting ? "select-none" : ""}`}>
          <Table>
            <TableHeader>
              <TableRow>
                {columnOrder.map((colId) => renderHeaderCell(colId))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isNavigating ? (
                // Skeleton loading rows
                Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={`skel-${i}`} cols={columnOrder.length} />
                ))
              ) : displayProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnOrder.length} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                        <Package className="h-8 w-8 text-neutral-500" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">
                          Nenhum produto encontrado
                        </p>
                        <p className="text-sm text-neutral-500 mt-1">
                          {hasActiveFilters || searchInput
                            ? "Tente alterar os filtros aplicados."
                            : "Comece adicionando seu primeiro produto."}
                        </p>
                      </div>
                      {canCreate && !hasActiveFilters && !searchInput && (
                        <Link href="/empresario/produtos/novo">
                          <Button size="sm" className="mt-2">
                            <Plus className="h-4 w-4" />
                            Novo Produto
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayProducts.map((product, index) => (
                  <TableRow
                    key={product.id}
                    selected={selectedIds.has(product.id)}
                    className="group cursor-pointer"
                    onMouseDown={(e) => {
                      if (!podeSelecionar || !(e.ctrlKey || e.metaKey)) return;
                      // Sem isso o navegador começa a selecionar o texto da tabela.
                      e.preventDefault();
                      dragSelectRef.current = {
                        anchor: index,
                        mode: selectedIds.has(product.id) ? "remove" : "add",
                        base: new Set(selectedIds),
                      };
                      setIsDragSelecting(true);
                      applySelectionRange(index, index, displayProducts);
                    }}
                    onMouseEnter={() => {
                      if (!dragSelectRef.current) return;
                      applySelectionRange(dragSelectRef.current.anchor, index, displayProducts);
                    }}
                  >
                    {columnOrder.map((colId) => renderBodyCell(colId, product))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Rodapé fluido — progresso + tamanho do lote + carregamento por rolagem */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-neutral-200 dark:border-white/[0.06]">
          <div className="min-w-0">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Mostrando{" "}
              <span className="font-medium text-neutral-900 dark:text-neutral-200">
                {displayProducts.length}
              </span>{" "}
              de{" "}
              <span className="font-medium text-neutral-900 dark:text-neutral-200">
                {total.toLocaleString("pt-BR")}
              </span>{" "}
              {total === 1 ? "produto" : "produtos"}
            </p>
            {podeSelecionar && (
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Segure <kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] font-mono text-[10px]">Ctrl</kbd>{" "}
                e clique — ou arraste sobre as linhas — para selecionar vários.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="produtos-per-page"
              className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap"
            >
              Itens por vez
            </label>
            <select
              id="produtos-per-page"
              value={perPage}
              onChange={(e) => handlePerPageChange(Number(e.target.value))}
              className="h-8 pl-2.5 pr-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/[0.08] rounded-[var(--radius-md)] text-sm text-neutral-900 dark:text-neutral-200 outline-none focus:border-primary-400 transition-colors cursor-pointer"
            >
              {PER_PAGE_OPTIONS.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sentinela do scroll infinito. Fica fora do container rolável da
            tabela pra observar a rolagem da página, e o botão abaixo é a saída
            manual quando o observer não dispara (aba em segundo plano, etc.). */}
        {hasMore && searchInput.trim() === (filters.search ?? "").trim() && (
          <div
            ref={sentinelRef}
            className="flex flex-col items-center justify-center gap-2 py-6 border-t border-neutral-200 dark:border-white/[0.06]"
          >
            {loadError ? (
              <>
                <p className="text-sm text-danger-400">{loadError}</p>
                <Button variant="secondary" size="sm" onClick={loadMore}>
                  Tentar de novo
                </Button>
              </>
            ) : loadingMore ? (
              <span className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
                Carregando mais produtos...
              </span>
            ) : (
              <Button variant="secondary" size="sm" onClick={loadMore}>
                Carregar mais
              </Button>
            )}
          </div>
        )}

        {!hasMore && total > perPage && (
          <p className="py-4 text-center text-xs text-neutral-500 border-t border-neutral-200 dark:border-white/[0.06]">
            Você chegou ao fim da lista.
          </p>
        )}
      </div>

      {/* Modals */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir produto"
        description={getDeleteDescription()}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteLoading}
      />

      <BatchEditModal
        open={showBatchEdit}
        onClose={() => setShowBatchEdit(false)}
        selectedIds={[...selectedIds]}
        categories={categories}
        onSuccess={() => {
          setSelectedIds(new Set());
          router.refresh();
        }}
      />

      <BatchAddModal
        open={showBatchAdd}
        onClose={() => setShowBatchAdd(false)}
        categories={categories}
        onSuccess={() => {
          router.refresh();
        }}
      />

      {previewImage && (
        <ImagePreviewModal
          open={!!previewImage}
          onClose={() => setPreviewImage(null)}
          imageUrl={previewImage.url}
          productName={previewImage.name}
        />
      )}

      <ProductQuickViewModal
        product={quickViewProduct}
        categories={categories}
        canUpdate={canUpdate}
        onClose={() => setQuickViewProduct(null)}
      />

      {/* Delete batch confirmation */}
      <ConfirmDialog
        open={showBatchDeleteConfirm}
        onClose={() => setShowBatchDeleteConfirm(false)}
        title="Excluir produtos selecionados"
        description={`Tem certeza que deseja excluir permanentemente ${selectedIds.size} ${selectedIds.size === 1 ? 'produto selecionado' : 'produtos selecionados'}? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir tudo"
        cancelLabel="Cancelar"
        onConfirm={handleBatchDelete}
        loading={batchDeleteLoading}
        variant="danger"
      />

      {/* Stock Modal */}
      <StockModal
        open={showStockModal}
        onClose={() => { setShowStockModal(false); setStockModalProducts([]); }}
        products={stockModalProducts}
        onConfirm={handleStockConfirm}
      />

      {/* Duplicate Warning Modal */}
      <Modal
        open={showDuplicateWarning}
        onClose={() => setShowDuplicateWarning(false)}
        className="max-w-sm"
      >
        <ModalHeader onClose={() => setShowDuplicateWarning(false)}>
          Itens já na lista
        </ModalHeader>
        <ModalBody className="space-y-3">
          <p className="text-sm text-neutral-300">
            Todos os {duplicateProductIds.length} item(ns) selecionado(s) já estão na lista de cotação.
          </p>
          <p className="text-sm text-neutral-400">
            Deseja removê-los da lista?
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowDuplicateWarning(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleRemoveDuplicates}
          >
            <ListMinus className="h-4 w-4" />
            Remover da lista
          </Button>
        </ModalFooter>
      </Modal>

      {/* Column Config Modal */}
      <ColumnConfigModal
        open={showColumnConfig}
        onClose={() => setShowColumnConfig(false)}
        title="Configurações"
        columns={PRODUCT_COLUMNS}
        columnOrder={columnOrder}
        onSave={handleSaveColumnOrder}
        columnLabels={columnLabels}
        onLabelsChange={handleSaveColumnLabels}
        featureDefs={PRODUCT_FEATURES}
        featureState={features}
        onFeaturesChange={setFeatures}
      />
    </div>
  );
}
