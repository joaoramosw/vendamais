"use client";

import { buscarProdutoPorBarcode } from "@/actions/cotacoes";
import { looksLikeBarcode } from "@/lib/barcode";
import {
    convidarFornecedor,
    convidarPorUsuarios,
    enviarCotacao,
    type FornecedorConvidadoRow,
} from "@/lib/api/cotacoes-api";
import { ConvitesCriadosModal } from "@/components/cotacoes/ConvitesCriadosList";
import { FornecedorSelector } from "@/components/cotacoes/FornecedorSelector";
import { formatPhone, isValidBrPhone } from "@/lib/whatsapp";
import { ObservationHistoryModal } from "@/components/cotacoes/ObservationHistoryModal";
import { BarcodeScanner } from "@/components/produtos/BarcodeScanner";
import { ImagePreviewModal } from "@/components/produtos/ImagePreviewModal";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import {
    ColumnConfigModal,
    loadColumnLabels,
    loadColumnOrder,
    saveColumnLabels,
    saveColumnOrder,
    type ColumnDef,
} from "@/components/ui/column-config-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditableNumberCell } from "@/components/ui/editable-number-cell";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { UNIT_TYPE_LABELS, UNIT_TYPES, type UnitType } from "@/lib/constants";
import { useDraftList, type DraftItem } from "@/lib/hooks/useDraftList";
import { useOfflineSync } from "@/lib/hooks/useOfflineSync";
import { applySorting, useTableSort } from "@/lib/hooks/useTableSort";
import { formatCurrency } from "@/lib/utils";
import {
    AlertCircle,
    ArrowRight,
    ArrowUp,
    Camera,
    ChevronDown,
    ClipboardList,
    Edit,
    Loader2,
    MessageSquarePlus,
    Package,
    Search,
    Send,
    Settings2,
    Trash2,
    X
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Feedback desta tela via **sonner**, não pelo `showToast` de
 * `@/components/ui/toast`.
 *
 * O sistema legado só desenha se a página montar um `<ToastContainer/>` — e
 * `/empresario/lista-cotacao` nunca montou. Resultado: todos os avisos daqui,
 * inclusive o "Cotação publicada com sucesso", eram emitidos e descartados em
 * silêncio. O sonner é global (`<SonnerToaster/>` no layout raiz) e, por isso,
 * também sobrevive ao redirect que acontece logo depois do envio — que é
 * exatamente o que este fluxo precisa. Mantido o nome `showToast` para não
 * reescrever as 20 chamadas do arquivo.
 */
function showToast(
  message: string,
  type: "success" | "error" | "warning" | "info" = "success",
) {
  if (type === "error") toast.error(message);
  else if (type === "warning") toast.warning(message);
  else if (type === "info") toast.info(message);
  else toast.success(message);
}

/* ─── Column definitions ─── */
const DRAFT_COLUMNS: ColumnDef[] = [
  { id: "select", label: "Selecionar", fixed: true, renamable: false },
  { id: "foto", label: "Foto" },
  { id: "produto", label: "Produto" },
  { id: "preco", label: "Preço unit." },
  { id: "estoque", label: "Estoque" },
  { id: "sugerido", label: "Qtd. cotacao" },
  { id: "unidade", label: "Unidade" },
  { id: "acoes", label: "Ações", fixed: true },
];
const DRAFT_DEFAULT_ORDER = DRAFT_COLUMNS.map((c) => c.id);
const DRAFT_COL_STORAGE_KEY = "vendamais_draft_columns";
const DEFAULT_UNIT_STORAGE_KEY = "vendamais_default_unit";
const UNIT_OPTIONS = UNIT_TYPES.map((u) => ({ value: u, label: UNIT_TYPE_LABELS[u] }));

interface CotacaoItemPayload {
  nome_produto: string;
  codigo_barras?: string;
  categoria?: string;
  estoque_atual?: number;
  quantidade_sugerida: number;
  unidade: DraftItem["tipoUnidade"];
  tipo_unidade: DraftItem["tipoUnidade"];
  quantidade: number;
  product_id: string;
}

function loadDefaultUnit(): string {
  if (typeof window === "undefined") return "CX";
  try {
    return localStorage.getItem(DEFAULT_UNIT_STORAGE_KEY) || "CX";
  } catch {
    return "CX";
  }
}

function saveDefaultUnit(unit: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEFAULT_UNIT_STORAGE_KEY, unit);
}

interface DraftListClientProps {
  userName?: string;
}

export function DraftListClient({ userName = "Usuário" }: DraftListClientProps) {
  const router = useRouter();
  const draftList = useDraftList();
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // busca unificada nome+barcode
  // Preview de imagem
  const [previewImage, setPreviewImage] = useState<{ url: string; nome: string } | null>(null);
  // Preview de item (modal com nome, foto, preço)
  const [previewItem, setPreviewItem] = useState<DraftItem | null>(null);
  // Observações (Histórico)
  const [viewingObservationHistory, setViewingObservationHistory] = useState<DraftItem | null>(null);

  // Offline Sync
  const { isOnline, queueAction } = useOfflineSync();

  // Seleção em lote
  const [draftSelectedIds, setDraftSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchRemoveConfirm, setShowBatchRemoveConfirm] = useState(false);
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  // Campos do modal de edição em lote
  const [batchQtd, setBatchQtd] = useState("");
  const [batchUnit, setBatchUnit] = useState<string>("");
  const [batchEstoque, setBatchEstoque] = useState("");

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fornecedoresSelecionados, setFornecedoresSelecionados] = useState<Set<string>>(new Set());
  // Números digitados na busca que não batem com nenhum fornecedor cadastrado —
  // viram convite avulso assim que a cotação existir (ela ainda não existe aqui).
  const [numerosPendentes, setNumerosPendentes] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  // Passo pós-publicação: convites já criados, esperando o clique que dispara
  // cada mensagem de WhatsApp.
  const [convitesCriados, setConvitesCriados] = useState<FornecedorConvidadoRow[]>([]);
  const [cotacaoPublicada, setCotacaoPublicada] = useState<{
    id: string;
    titulo: string;
    totalItens: number;
    dataLimite: string | null;
  } | null>(null);

  // Column config
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    loadColumnOrder(DRAFT_COL_STORAGE_KEY, DRAFT_DEFAULT_ORDER)
  );
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>(() =>
    loadColumnLabels(DRAFT_COL_STORAGE_KEY)
  );
  const [defaultUnit, setDefaultUnit] = useState<string>(() => loadDefaultUnit());

  const allDraftSelected =
    draftList.items.length > 0 &&
    draftList.items.every((i) => draftSelectedIds.has(i.productId));

  const toggleDraftAll = () => {
    if (allDraftSelected) {
      setDraftSelectedIds(new Set());
    } else {
      setDraftSelectedIds(new Set(draftList.items.map((i) => i.productId)));
    }
  };

  const toggleDraftOne = (productId: string) => {
    setDraftSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleBatchRemoveFromDraft = () => {
    const n = draftSelectedIds.size;
    draftSelectedIds.forEach((id) => draftList.removeItem(id));
    setDraftSelectedIds(new Set());
    setShowBatchRemoveConfirm(false);
    showToast(`${n} item(ns) removido(s) da lista.`, "info");
  };

  const handleBatchEdit = () => {
    draftSelectedIds.forEach((id) => {
      const updates: Partial<Omit<DraftItem, "productId">> = {};
      if (batchQtd !== "") updates.quantidadeSugerida = parseInt(batchQtd) || 1;
      if (batchUnit !== "") updates.tipoUnidade = batchUnit as DraftItem["tipoUnidade"];
      if (batchEstoque !== "") updates.estoque = parseInt(batchEstoque) || 0;
      if (Object.keys(updates).length > 0) draftList.updateItem(id, updates);
    });
    setShowBatchEditModal(false);
    setBatchQtd(""); setBatchUnit(""); setBatchEstoque("");
    showToast(`${draftSelectedIds.size} item(ns) atualizado(s).`, "success");
    setDraftSelectedIds(new Set());
  };

  /* ─── Barcode search ─── */
  async function handleBarcodeSearch(code: string) {
    if (!code.trim()) return;
    setBarcodeLoading(true);
    try {
      const product = await buscarProdutoPorBarcode(code.trim());
      if (product) {
        if (draftList.hasItem(product.id)) {
          showToast("Produto já está na lista.", "info");
        } else {
          draftList.addItem({
            productId: product.id,
            nome: product.name,
            foto: product.image_url ?? null,
            codigoBarras: product.barcode ?? null,
            categoria: product.category ?? null,
            precoAtual: product.price_unit_store > 0 ? product.price_unit_store : null,
            estoque: 0,
            // Zero = campo vazio ("clique para preencher") — ver useDraftList.
            quantidadeSugerida: 0,
            tipoUnidade: defaultUnit as DraftItem["tipoUnidade"],
          });
          showToast(`"${product.name}" adicionado!`, "success");
        }
        setSearchQuery("");
      } else {
        showToast("Produto não encontrado. Abrindo cadastro de produto...", "warning");
        router.push(`/empresario/produtos/novo?barcode=${encodeURIComponent(code.trim())}`);
      }
    } catch {
      showToast("Erro ao buscar produto.", "error");
    } finally {
      setBarcodeLoading(false);
    }
  }

  function handleBarcodeDetected(code: string) {
    setShowScanner(false);
    handleBarcodeSearch(code);
  }

  /* ─── Inline edit helpers ─── */
  function updateField(
    productId: string,
    field: keyof DraftItem,
    value: string | number
  ) {
    draftList.updateItem(productId, { [field]: value });
  }

  /* ─── Observation handlers ─── */
  function handleAddNote(texto: string) {
    if (!viewingObservationHistory) return;
    const newItem = { ...viewingObservationHistory };
    const currentNotes = newItem.observacoes || [];
    const newNote = {
      id: Date.now().toString(),
      texto,
      autor: userName,
      dataCriacao: new Date().toISOString(),
      resolvida: false,
    };
    
    const updatedNotes = [...currentNotes, newNote];
    draftList.updateItem(newItem.productId, { observacoes: updatedNotes });
    
    // Atualiza o estado local para o modal refletir imediatamente
    setViewingObservationHistory({ ...newItem, observacoes: updatedNotes });
  }

  function handleResolveNote(noteId: string) {
    if (!viewingObservationHistory) return;
    const newItem = { ...viewingObservationHistory };
    const updatedNotes = (newItem.observacoes || []).map((obs) =>
      obs.id === noteId ? { ...obs, resolvida: true } : obs
    );
    
    draftList.updateItem(newItem.productId, { observacoes: updatedNotes });
    setViewingObservationHistory({ ...newItem, observacoes: updatedNotes });
    showToast("Nota resolvida.", "success");
  }

  function handleDeleteNote(noteId: string) {
    if (!viewingObservationHistory) return;
    const newItem = { ...viewingObservationHistory };
    const updatedNotes = (newItem.observacoes || []).filter((obs) => obs.id !== noteId);
    
    draftList.updateItem(newItem.productId, { observacoes: updatedNotes });
    setViewingObservationHistory({ ...newItem, observacoes: updatedNotes });
    showToast("Nota apagada.", "info");
  }

  /* ─── Sorting ─── */
  const { sortCriteria, toggleSort, getSortDirection, getSortIndex } = useTableSort();

  const getDraftSortField = useCallback(
    (item: DraftItem, column: string): string | number | null | undefined => {
      switch (column) {
        case "produto": return item.nome;
        case "preco": return item.precoAtual;
        case "estoque": return item.estoque;
        case "sugerido": return item.quantidadeSugerida;
        case "unidade": return item.tipoUnidade;
        default: return null;
      }
    },
    []
  );

  /* ─── Filtered + Sorted items (memoized for performance) ─── */
  const filteredItems = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = searchQuery
      ? draftList.items.filter(
          (item) =>
            item.nome.toLowerCase().includes(lowerQuery) ||
            (item.codigoBarras ?? "").toLowerCase().includes(lowerQuery)
        )
      : draftList.items;

    return applySorting(filtered, sortCriteria, getDraftSortField);
  }, [draftList.items, searchQuery, sortCriteria, getDraftSortField]);

  /* ─── Navegação por teclado entre Estoque e Sugestão ───
   *
   * A ordem é sempre Estoque₁ → Sugestão₁ → Estoque₂ → Sugestão₂ → …, **não**
   * a ordem do DOM: as colunas da tabela são reordenáveis pelo usuário, então
   * confiar na tab order nativa faria a sequência mudar junto com o layout.
   * Tab e Enter percorrem a mesma lista.
   *
   * O foco é resolvido por `data-foco` no elemento (ver EditableNumberCell) em
   * vez de um mapa de refs: as chaves carregam o `productId` (uuid), então não
   * há risco de colisão na página, e não é preciso registrar/desregistrar nada
   * a cada render.
   */
  const chaveFoco = (productId: string, campo: "estoque" | "sugerido") =>
    `${productId}:${campo}`;

  const ordemFoco = useMemo(
    () =>
      filteredItems.flatMap((item) => [
        chaveFoco(item.productId, "estoque"),
        chaveFoco(item.productId, "sugerido"),
      ]),
    [filteredItems],
  );

  /** Move o foco para o campo vizinho. Devolve `false` quando não há vizinho
   * (primeiro/último campo da tabela) — aí o Tab nativo segue seu curso. */
  const navegarFoco = useCallback(
    (chaveAtual: string, direcao: "proximo" | "anterior"): boolean => {
      const indice = ordemFoco.indexOf(chaveAtual);
      if (indice === -1) return false;
      const alvo = ordemFoco[indice + (direcao === "proximo" ? 1 : -1)];
      if (!alvo) return false;

      // rAF: a célula de origem ainda vai desmontar o input neste tick (commit
      // logo depois desta chamada); focar antes disso perderia o foco.
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-foco="${alvo}"]`);
        el?.focus();
        if (el instanceof HTMLInputElement) el.select();
      });
      return true;
    },
    [ordemFoco],
  );

  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = searchQuery.trim();
    if (!q) return;
    if (looksLikeBarcode(q)) {
      // Tenta adicionar produto pelo barcode
      await handleBarcodeSearch(q);
      setSearchQuery("");
    }
    // se for nome, apenas filtra (já reativo)
  }

  /* ─── Column config ─── */
  const handleSaveColumnOrder = useCallback((newOrder: string[]) => {
    setColumnOrder(newOrder);
    saveColumnOrder(DRAFT_COL_STORAGE_KEY, newOrder);
  }, []);

  const handleSaveColumnLabels = useCallback((newLabels: Record<string, string>) => {
    setColumnLabels(newLabels);
    saveColumnLabels(DRAFT_COL_STORAGE_KEY, newLabels);
  }, []);

  const handleDefaultUnitChange = useCallback((unit: string) => {
    setDefaultUnit(unit);
    saveDefaultUnit(unit);
  }, []);

  const toQuotationItemPayload = useCallback(
    (item: DraftItem): CotacaoItemPayload => {
      // Sem fallback pra 1: item sem quantidade sai daqui com zero e é barrado
      // por `hasInvalidQuantity` em handleSend — a checagem é lá, num lugar só.
      const quantidade = Number.isFinite(item.quantidadeSugerida)
        ? Math.max(0, Math.trunc(item.quantidadeSugerida))
        : 0;

      return {
        nome_produto: item.nome,
        codigo_barras: item.codigoBarras || undefined,
        categoria: item.categoria || undefined,
        estoque_atual: item.estoque > 0 ? item.estoque : undefined,
        quantidade_sugerida: quantidade,
        unidade: item.tipoUnidade,
        tipo_unidade: item.tipoUnidade,
        quantidade,
        product_id: item.productId,
      };
    },
    []
  );

  /* ─── Render cell by column ID ─── */
  const renderHeaderCell = (colId: string) => {
    switch (colId) {
      case "select":
        return (
          <TableHead key={colId} className="w-[40px]">
            <button
              type="button"
              role="checkbox"
              aria-checked={allDraftSelected}
              onClick={toggleDraftAll}
              className={`relative h-[18px] w-[18px] rounded-md border-2 transition-all duration-200 cursor-pointer flex items-center justify-center ${
                allDraftSelected
                  ? "bg-primary-500 border-primary-500"
                  : "bg-transparent border-white/20 hover:border-white/40"
              }`}
            >
              {allDraftSelected && <X className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
            </button>
          </TableHead>
        );
      case "foto":
        return <TableHead key={colId} className="w-[60px]">{columnLabels.foto ?? "Foto"}</TableHead>;
      case "produto":
      case "preco":
      case "estoque":
      case "sugerido":
      case "unidade": {
        const defaultLabel = { produto: "Produto", preco: "Preço unit.", estoque: "Estoque", sugerido: "Qtd. cotacao", unidade: "Unidade" }[colId];
        const label = columnLabels[colId] ?? defaultLabel;
        const width = { produto: undefined, preco: "w-[120px]", estoque: "w-[100px]", sugerido: "w-[100px]", unidade: "w-[120px]" }[colId];
        const dir = getSortDirection(colId);
        const idx = getSortIndex(colId);
        const hintMap: Record<string, { asc: string; desc: string }> = {
          produto:  { asc: "A → Z",  desc: "Z → A" },
          preco:    { asc: "$ ↑",    desc: "$ ↓" },
          estoque:  { asc: "# ↑",    desc: "# ↓" },
          sugerido: { asc: "# ↑",    desc: "# ↓" },
          unidade:  { asc: "A → Z",  desc: "Z → A" },
        };
        const hint = hintMap[colId];
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
        return <TableHead key={colId} className="w-[60px]">{columnLabels.acoes ?? "Ações"}</TableHead>;
      default:
        return null;
    }
  };

  const renderBodyCell = (colId: string, item: DraftItem) => {
    switch (colId) {
      case "select":
        return (
          <TableCell key={colId} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              role="checkbox"
              aria-checked={draftSelectedIds.has(item.productId)}
              onClick={() => toggleDraftOne(item.productId)}
              className={`relative h-[18px] w-[18px] rounded-md border-2 transition-all duration-200 cursor-pointer flex items-center justify-center ${
                draftSelectedIds.has(item.productId)
                  ? "bg-primary-500 border-primary-500"
                  : "bg-transparent border-white/20 hover:border-white/40"
              }`}
            >
              {draftSelectedIds.has(item.productId) && (
                <span className="text-white text-[9px] font-bold leading-none">✓</span>
              )}
            </button>
          </TableCell>
        );
      case "foto":
        return (
          <TableCell key={colId}>
            {item.foto ? (
              <button
                type="button"
                onClick={() => setPreviewImage({ url: item.foto!, nome: item.nome })}
                className="relative h-[44px] w-[44px] rounded-[var(--radius-md)] overflow-hidden bg-white/[0.06] cursor-zoom-in hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                title="Ver imagem ampliada"
              >
                <Image
                  src={item.foto}
                  alt={item.nome}
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              </button>
            ) : (
              <div className="h-[44px] w-[44px] rounded-[var(--radius-md)] bg-white/[0.04] flex items-center justify-center">
                <Package className="h-5 w-5 text-neutral-600" />
              </div>
            )}
          </TableCell>
        );
      case "produto":
        const hasUnresolvedNotes = item.observacoes?.some((obs) => !obs.resolvida);

        return (
          <TableCell
            key={colId}
            className="cursor-pointer"
            onClick={() => setPreviewItem(item)}
            title="Clique para ver detalhes"
          >
            <div className="flex items-center justify-between gap-3 pr-2">
              <div>
                <span className="font-semibold text-neutral-100 line-clamp-1">
                  {item.nome}
                </span>
                {item.codigoBarras && (
                  <span className="text-xs text-neutral-500 mt-0.5 block font-mono">
                    {item.codigoBarras}
                  </span>
                )}
              </div>
              {hasUnresolvedNotes && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingObservationHistory(item);
                  }}
                  className="bg-yellow-500 text-yellow-950 p-1.5 rounded-full animate-pulse hover:animate-none hover:scale-110 transition-transform cursor-pointer shrink-0 shadow-lg shadow-yellow-500/20"
                  title="Existem notas pendentes neste produto"
                >
                  <AlertCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </TableCell>
        );
      case "preco":
        return (
          <TableCell key={colId}>
            {item.precoAtual ? (
              <span className="text-sm font-bold text-success-400">
                {formatCurrency(item.precoAtual)}
              </span>
            ) : (
              <span className="text-xs text-neutral-600 italic">—</span>
            )}
          </TableCell>
        );
      case "estoque":
        return (
          <TableCell key={colId}>
            <input
              type="number"
              min="0"
              step="1"
              data-foco={chaveFoco(item.productId, "estoque")}
              value={item.estoque}
              onChange={(e) =>
                updateField(
                  item.productId,
                  "estoque",
                  parseInt(e.target.value) || 0
                )
              }
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== "Tab") return;
                // O valor já foi gravado no onChange (input controlado), então
                // aqui só resta mover o foco.
                const movido = navegarFoco(
                  chaveFoco(item.productId, "estoque"),
                  e.shiftKey ? "anterior" : "proximo",
                );
                if (movido) e.preventDefault();
              }}
              className="w-20 bg-neutral-900 border border-white/[0.08] rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-center text-neutral-200 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
            />
          </TableCell>
        );
      case "sugerido":
        return (
          <TableCell key={colId}>
            {/* min=0 para que a célula possa voltar a ficar vazia (apagar o
                número não deve reescrever "1" por conta própria). */}
            <EditableNumberCell
              value={item.quantidadeSugerida}
              min={0}
              title="Clique para informar a quantidade a cotar"
              focusKey={chaveFoco(item.productId, "sugerido")}
              editOnFocus
              onNavigate={(direcao) =>
                navegarFoco(chaveFoco(item.productId, "sugerido"), direcao)
              }
              onChange={(v) =>
                updateField(item.productId, "quantidadeSugerida", v)
              }
            />
          </TableCell>
        );
      case "unidade":
        return (
          <TableCell key={colId}>
            <div className="relative">
              <select
                value={item.tipoUnidade}
                onChange={(e) =>
                  updateField(
                    item.productId,
                    "tipoUnidade",
                    e.target.value as UnitType
                  )
                }
                className="w-full h-8 bg-neutral-900 border border-white/[0.08] rounded-[var(--radius-md)] text-white text-sm pl-2.5 pr-7 appearance-none outline-none focus:border-primary-500 transition-colors cursor-pointer"
              >
                {UNIT_TYPES.map((u) => (
                  <option
                    key={u}
                    value={u}
                    className="bg-neutral-900"
                  >
                    {u} — {UNIT_TYPE_LABELS[u]}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-2 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
            </div>
          </TableCell>
        );
      case "acoes":
        return (
          <TableCell key={colId}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewingObservationHistory(item)}
                className={`p-1.5 rounded-[var(--radius-md)] transition-colors cursor-pointer ${
                  item.observacoes && item.observacoes.length > 0
                    ? "text-primary-400 hover:text-primary-300 hover:bg-primary-500/10"
                    : "text-neutral-500 hover:text-neutral-400 hover:bg-white/[0.04]"
                }`}
                title="Histórico de Notas"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  draftList.removeItem(item.productId);
                  showToast("Item removido.", "info");
                }}
                className="p-1.5 rounded-[var(--radius-md)] text-neutral-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors cursor-pointer"
                title="Remover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </TableCell>
        );
      default:
        return null;
    }
  };

  /* ─── Convite avulso por WhatsApp (cotação ainda não existe) ─── */
  function handleAdicionarNumeroPendente(numero: string) {
    if (!isValidBrPhone(numero)) {
      showToast("Informe um número válido com DDD (ex.: (11) 91234-5678).", "warning");
      return;
    }
    const digits = numero.replace(/\D/g, "");
    setNumerosPendentes((prev) =>
      prev.some((n) => n.replace(/\D/g, "") === digits) ? prev : [...prev, numero]
    );
    showToast(`${formatPhone(numero)} será convidado por WhatsApp ao publicar.`, "success");
  }

  function handleRemoverNumeroPendente(numero: string) {
    setNumerosPendentes((prev) => prev.filter((n) => n !== numero));
  }

  /* ─── Enviar cotação ─── */
  async function handleSend() {
    if (sendingRef.current) return;

    const trimmedTitulo = titulo.trim();

    if (!trimmedTitulo) {
      showToast("Título é obrigatório.", "warning");
      return;
    }
    if (draftList.items.length === 0) {
      showToast("A lista está vazia.", "warning");
      return;
    }

    const itens = draftList.items.map(toQuotationItemPayload);
    const hasInvalidQuantity = itens.some((item) => item.quantidade <= 0);
    if (hasInvalidQuantity) {
      showToast("Defina uma quantidade de cotacao maior que zero para todos os itens.", "warning");
      return;
    }

    sendingRef.current = true;
    setSending(true);

    try {
      if (!isOnline) {
        // Enfileira para envio offline
        const queued = await queueAction({
          type: "CREATE_QUOTATION",
          payload: {
            titulo: trimmedTitulo,
            descricao: descricao.trim(),
            data_limite: prazo || "",
            itens,
            publishAfterCreate: true,
          }
        });

        if (!queued) {
          throw new Error("Não foi possível salvar a cotação na fila offline. Tente novamente.");
        }

        if (numerosPendentes.length > 0) {
          // A fila offline só recria a cotação; convite depende de estar online.
          showToast(
            "Os convites por WhatsApp precisam de conexão — convide esses números na tela da cotação depois que ela subir.",
            "warning",
          );
        }

        setTitulo("");
        setPrazo("");
        setDescricao("");
        setNumerosPendentes([]);
        draftList.clearAll();
        setDraftSelectedIds(new Set());
        setShowSendModal(false);
        showToast("Você está offline. A cotação foi salva e será enviada quando reconectar.", "success");
        router.push("/empresario/cotacoes");
        return;
      }

      // Envio Online Normal — via o backend novo (NestJS/Fastify), não mais
      // a Server Action criarEPublicarCotacao. O backend faz criar+publicar
      // sem depender do embed PostgREST cotacoes<->cotacao_itens (a FK que
      // nunca existiu no banco real — ver CLAUDE.md "Known Issues" e o plano
      // desta sessão). Itens já vêm com unidade/tipo_unidade preenchidos por
      // toQuotationItemPayload.
      const result = await enviarCotacao({
        titulo: trimmedTitulo,
        data_limite: prazo || undefined,
        itens,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const criados: FornecedorConvidadoRow[] = [];

      // Cotação já foi publicada com sucesso — falha em qualquer convite não
      // desfaz isso, só avisa separadamente.
      if (fornecedoresSelecionados.size > 0) {
        try {
          criados.push(
            ...(await convidarPorUsuarios(result.id, Array.from(fornecedoresSelecionados))),
          );
        } catch (conviteError) {
          showToast(
            conviteError instanceof Error
              ? `Cotação publicada, mas houve erro ao convidar fornecedores: ${conviteError.message}`
              : "Cotação publicada, mas houve erro ao convidar fornecedores.",
            "warning",
          );
        }
      }

      for (const numero of numerosPendentes) {
        try {
          criados.push(await convidarFornecedor(result.id, { whatsapp: numero }));
        } catch (conviteError) {
          showToast(
            conviteError instanceof Error
              ? `Cotação publicada, mas houve erro ao convidar ${formatPhone(numero)}: ${conviteError.message}`
              : `Cotação publicada, mas houve erro ao convidar ${formatPhone(numero)}.`,
            "warning",
          );
        }
      }

      const totalItens = draftList.items.length;

      setTitulo("");
      setPrazo("");
      setDescricao("");
      setFornecedoresSelecionados(new Set());
      setNumerosPendentes([]);
      draftList.clearAll();
      setDraftSelectedIds(new Set());
      setShowSendModal(false);
      showToast(
        `Cotação "${trimmedTitulo}" enviada com sucesso! ${totalItens} ${
          totalItens === 1 ? "item" : "itens"
        } para os fornecedores.`,
        "success",
      );

      if (criados.some((c) => c.whatsapp)) {
        // Fica na tela pra que o disparo do WhatsApp parta de um clique do
        // usuário — abrir wa.me automaticamente aqui seria barrado como pop-up.
        setCotacaoPublicada({
          id: result.id,
          titulo: trimmedTitulo,
          totalItens,
          dataLimite: prazo || null,
        });
        setConvitesCriados(criados);
        return;
      }

      // Deep-link direto no detalhe: a cotação recém-enviada abre já pronta
      // pra acompanhar as respostas, em vez de cair na lista e obrigar a
      // procurar o card (o antigo `?aberta=<id>` só rolava a lista até ele).
      router.push(`/empresario/cotacoes/${result.id}`);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Erro ao criar cotação.";
      showToast(message, "error");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-primary-400" />
            Lista de Cotação
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Monte sua lista e envie aos fornecedores para receber propostas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setShowColumnConfig(true)}
            title="Configurar colunas"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          {draftList.count > 0 && (
            <span className="text-xs text-neutral-500 bg-white/[0.04] px-3 py-1.5 rounded-full border border-white/[0.06]">
              {draftList.count} {draftList.count === 1 ? "item" : "itens"}
            </span>
          )}
        </div>
      </div>

      {/* Toolbar — barcode search + scanner */}
      <Card>
        <CardBody className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              id="barcode-search-input"
              type="text"
              placeholder="Buscar por nome ou cód. barras (Enter para adicionar)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2.5 border border-white/[0.08] rounded-[var(--radius-md)] bg-neutral-900 text-neutral-100 text-sm placeholder:text-neutral-600 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
            />
            {barcodeLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400 animate-spin" />
            )}
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => handleBarcodeSearch(searchQuery)}
            disabled={!searchQuery.trim() || barcodeLoading}
          >
            <Search className="h-4 w-4" />
            Buscar
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowScanner((prev) => !prev)}
          >
            <Camera className="h-4 w-4" />
            Escanear
          </Button>
          {draftList.count > 0 && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowClearConfirm(true)}
              className="text-danger-400 hover:text-danger-300"
            >
              <Trash2 className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </CardBody>
      </Card>

      {/* Scanner */}
      {showScanner && (
        <div className="animate-fade-in">
          <BarcodeScanner
            onDetected={handleBarcodeDetected}
            onClose={() => setShowScanner(false)}
          />
        </div>
      )}

      {/* Toolbar de seleção em lote */}
      {draftSelectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary-500/10 border border-primary-500/20 rounded-[var(--radius-md)] animate-fade-in">
          <span className="text-sm text-primary-300 font-medium">
            {draftSelectedIds.size} item(ns) selecionado(s)
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBatchEditModal(true)}
            >
              <Edit className="h-3.5 w-3.5" />
              Editar selecionados
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBatchRemoveConfirm(true)}
              className="text-danger-400 hover:text-danger-300 hover:bg-danger-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover selecionados
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {columnOrder.map((colId) => renderHeaderCell(colId))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {draftList.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnOrder.length}>
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-white/[0.04] flex items-center justify-center">
                      <Package className="h-8 w-8 text-neutral-500" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-neutral-300">
                        Lista vazia
                      </p>
                      <p className="text-sm text-neutral-500 mt-1">
                        Adicione produtos a partir da{" "}
                        <button
                          onClick={() => router.push("/empresario/produtos")}
                          className="text-primary-400 hover:underline cursor-pointer"
                        >
                          gestão de produtos
                        </button>{" "}
                        ou busque por código de barras.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.productId} className="group" selected={draftSelectedIds.has(item.productId)}>
                  {columnOrder.map((colId) => renderBodyCell(colId, item))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {draftList.count > 0 && (
          <CardFooter className="flex items-center justify-end">
            <Button
              size="lg"
              onClick={() => setShowSendModal(true)}
            >
              <Send className="h-4 w-4" />
              Enviar Cotação
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Info box */}
      {draftList.count > 0 && (
        <div className="flex items-start gap-3 p-4 bg-success-500/5 border border-success-500/10 rounded-[var(--radius-lg)] animate-fade-in">
          <Send className="h-4 w-4 text-success-400 mt-0.5 shrink-0" />
          <p className="text-xs text-success-400/80 leading-relaxed">
            Ao enviar, os fornecedores receberão:{" "}
            <strong>Nome, Foto, Código de barras, Quantidade</strong> e a{" "}
            <strong>Unidade Comercial</strong>, além do campo para preencher{" "}
            <strong>Preço por unidade</strong>. O <em>estoque</em> não é
            compartilhado.
          </p>
        </div>
      )}

      {/* Send Modal */}
      <Modal
        open={showSendModal}
        onClose={() => {
          if (!sending) setShowSendModal(false);
        }}
        className="max-w-lg"
      >
        <ModalHeader onClose={() => {
          if (!sending) setShowSendModal(false);
        }}>
          Enviar Cotação
        </ModalHeader>
        <ModalBody className="space-y-4">
          <p className="text-sm text-neutral-400">
            Defina um título e prazo para publicar a cotação com{" "}
            {draftList.count} {draftList.count === 1 ? "item" : "itens"}.
          </p>
          <Input
            label="Título da cotação *"
            placeholder="Ex: Compra mensal de insumos"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            autoFocus
          />
          <Input
            label="Data limite para propostas"
            type="datetime-local"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
          />
          <Input
            label="Descrição / Observações (opcional)"
            placeholder="Condições de entrega, etc."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-400">
              Convidar fornecedores (opcional)
            </label>
            <FornecedorSelector
              selected={fornecedoresSelecionados}
              onChange={setFornecedoresSelecionados}
              onConvidarNumero={handleAdicionarNumeroPendente}
              numerosJaConvidados={
                new Set(numerosPendentes.map((n) => n.replace(/\D/g, "")))
              }
            />
            {numerosPendentes.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {numerosPendentes.map((numero) => (
                  <span
                    key={numero}
                    className="inline-flex items-center gap-1.5 text-xs bg-success-500/10 border border-success-500/25 rounded-full pl-3 pr-1.5 py-1 text-success-300"
                  >
                    {formatPhone(numero)}
                    <button
                      type="button"
                      onClick={() => handleRemoverNumeroPendente(numero)}
                      title="Remover convite"
                      className="p-0.5 rounded-full text-success-300/70 hover:text-success-200 hover:bg-success-500/20 transition-colors cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowSendModal(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSend} loading={sending}>
            Publicar Cotação
            <ArrowRight className="h-4 w-4" />
          </Button>
        </ModalFooter>
      </Modal>

      {/* Convites criados — disparo do WhatsApp depois de publicar */}
      {cotacaoPublicada && (
        <ConvitesCriadosModal
          open
          convites={convitesCriados}
          cotacaoTitulo={cotacaoPublicada.titulo}
          totalItens={cotacaoPublicada.totalItens}
          dataLimite={cotacaoPublicada.dataLimite}
          onClose={() => {
            const { id } = cotacaoPublicada;
            setCotacaoPublicada(null);
            setConvitesCriados([]);
            router.push(`/empresario/cotacoes/${id}`);
          }}
        />
      )}

      {/* Clear Confirm */}
      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          draftList.clearAll();
          setShowClearConfirm(false);
          showToast("Lista limpa.", "info");
        }}
        title="Limpar lista"
        description="Tem certeza que deseja remover todos os itens da lista?"
        confirmLabel="Limpar tudo"
        variant="danger"
      />

      {/* Confirm: remover selecionados em lote */}
      <ConfirmDialog
        open={showBatchRemoveConfirm}
        onClose={() => setShowBatchRemoveConfirm(false)}
        onConfirm={handleBatchRemoveFromDraft}
        title="Remover itens selecionados"
        description={`Tem certeza que deseja remover ${draftSelectedIds.size} item(ns) da lista de cotação?`}
        confirmLabel="Remover"
        variant="danger"
      />

      {/* Modal: editar em lote */}
      <Modal
        open={showBatchEditModal}
        onClose={() => setShowBatchEditModal(false)}
        className="max-w-sm"
      >
        <ModalHeader onClose={() => setShowBatchEditModal(false)}>
          Editar {draftSelectedIds.size} item(ns)
        </ModalHeader>
        <ModalBody className="space-y-4">
          <p className="text-xs text-neutral-400">
            Preencha apenas os campos que deseja alterar. Campos vazios serão ignorados.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-400">Qtd. sugerida</label>
            <input
              type="number" min="1" step="1"
              placeholder="Ex: 10"
              value={batchQtd}
              onChange={(e) => setBatchQtd(e.target.value)}
              className="w-full bg-neutral-900 border border-white/[0.08] rounded-[var(--radius-md)] px-3 py-2 text-sm text-neutral-200 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-400">Estoque atual</label>
            <input
              type="number" min="0" step="1"
              placeholder="Ex: 5"
              value={batchEstoque}
              onChange={(e) => setBatchEstoque(e.target.value)}
              className="w-full bg-neutral-900 border border-white/[0.08] rounded-[var(--radius-md)] px-3 py-2 text-sm text-neutral-200 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-400">Tipo de unidade</label>
            <select
              value={batchUnit}
              onChange={(e) => setBatchUnit(e.target.value)}
              className="w-full bg-neutral-900 border border-white/[0.08] rounded-[var(--radius-md)] px-3 py-2 text-sm text-neutral-200 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
            >
              <option value="">(manter atual)</option>
              {UNIT_TYPES.map((u) => (
                <option key={u} value={u} className="bg-neutral-900">
                  {u} — {UNIT_TYPE_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowBatchEditModal(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleBatchEdit}
            disabled={batchQtd === "" && batchUnit === "" && batchEstoque === ""}
          >
            Aplicar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: preview de item */}
      <Modal
        open={!!previewItem}
        onClose={() => setPreviewItem(null)}
        className="max-w-sm"
      >
        <ModalHeader onClose={() => setPreviewItem(null)}>
          {previewItem?.nome}
        </ModalHeader>
        <ModalBody className="space-y-4">
          {previewItem?.foto && (
            <div className="relative h-48 w-full rounded-[var(--radius-md)] overflow-hidden bg-white/[0.04]">
              <Image
                src={previewItem.foto}
                alt={previewItem.nome}
                fill
                className="object-contain"
                sizes="400px"
              />
            </div>
          )}
          <div className="space-y-2">
            {previewItem?.codigoBarras && (
              <p className="text-xs text-neutral-500 font-mono">{previewItem.codigoBarras}</p>
            )}
            {previewItem?.categoria && (
              <p className="text-xs text-neutral-400">
                Categoria: <span className="text-neutral-200">{previewItem.categoria}</span>
              </p>
            )}
            <p className="text-sm font-medium text-neutral-300">
              Preço por unidade:{" "}
              {previewItem?.precoAtual ? (
                <span className="text-success-400 font-bold">{formatCurrency(previewItem.precoAtual)}</span>
              ) : (
                <span className="text-neutral-600 italic">Não informado</span>
              )}
            </p>
          </div>
        </ModalBody>
      </Modal>

      {/* Modal de Histórico de Observação */}
      <ObservationHistoryModal
        open={!!viewingObservationHistory}
        onClose={() => setViewingObservationHistory(null)}
        productName={viewingObservationHistory?.nome || ""}
        observacoes={viewingObservationHistory?.observacoes || []}
        onAddNote={handleAddNote}
        onResolveNote={handleResolveNote}
        onDeleteNote={handleDeleteNote}
      />

      {/* Modal de preview de imagem */}
      {previewImage && (
        <ImagePreviewModal
          open={true}
          imageUrl={previewImage.url}
          productName={previewImage.nome}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* Column Config Modal */}
      <ColumnConfigModal
        open={showColumnConfig}
        onClose={() => setShowColumnConfig(false)}
        columns={DRAFT_COLUMNS}
        columnOrder={columnOrder}
        onSave={handleSaveColumnOrder}
        columnLabels={columnLabels}
        onLabelsChange={handleSaveColumnLabels}
        defaultUnit={defaultUnit}
        onDefaultUnitChange={handleDefaultUnitChange}
        unitOptions={UNIT_OPTIONS}
      />
    </div>
  );
}
