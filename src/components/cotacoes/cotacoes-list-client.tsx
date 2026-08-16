"use client";

/**
 * Tela de gerenciamento das cotações do empresário.
 *
 * Além de listar, ela é o painel de operações em lote: seleção múltipla
 * (Ctrl/⌘ + clique, Ctrl + arrastar, ou a caixinha do card), agrupamento,
 * pausar/retomar e excluir.
 *
 * Duas decisões que valem lembrar antes de mexer:
 *
 * 1. **"Pausar" é fechar temporariamente.** O enum real de `cotacao_status`
 *    tem só rascunho|aberta|fechada|cancelada — não existe 'pausada', e o
 *    projeto não tem acesso a DDL. Então pausar = 'fechada' (para de aceitar
 *    propostas) e retomar = volta pra 'aberta' (transição liberada no
 *    backend). Por isso o botão do card fechado se chama "Retomar".
 * 2. **Os grupos dependem da migration 021.** Enquanto ela não for aplicada,
 *    o backend responde `disponivel: false`, a lista aparece sem seções e só
 *    o botão "Agrupar" fica desabilitado, explicando o motivo. Nada mais
 *    quebra.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeletons";
import { Tooltip } from "@/components/ui/tooltip";
import type { CotacaoStatus } from "@/lib/constants";
import { COTACAO_STATUS_LABELS } from "@/lib/constants";
import {
  atribuirGrupoCotacoes,
  criarGrupoCotacao,
  deletarCotacao,
  encerrarCotacao,
  excluirGrupoCotacao,
  listarCotacoes,
  listarGruposCotacao,
  publicarCotacaoPorId,
  reabrirCotacao,
  renomearGrupoCotacao,
  type CotacaoGrupo,
  type CotacaoListItem,
} from "@/lib/api/cotacoes-api";
import { cn, formatDate } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Folder,
  FolderInput,
  Inbox,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AgruparCotacoesModal, type DestinoGrupo } from "@/components/cotacoes/AgruparCotacoesModal";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "aberta", label: "Aberta" },
  { value: "fechada", label: "Pausada / Fechada" },
  { value: "cancelada", label: "Cancelada" },
];

/**
 * Cores das ações em lote. `variant="outline"` do Button não traz cor
 * nenhuma de propósito (ver o comentário no próprio componente), então cada
 * ação precisa trazer fundo, texto, borda e hover inteiros — esquecer um
 * deles deixa o botão cinza/invisível.
 */
const ACAO_LOTE = {
  agrupar:
    "bg-white/60 dark:bg-white/[0.06] text-primary-700 dark:text-primary-300 border-primary-500/40 hover:bg-primary-500/15",
  pausar:
    "bg-white/60 dark:bg-white/[0.06] text-warning-700 dark:text-warning-300 border-warning-500/40 hover:bg-warning-500/15",
  retomar:
    "bg-white/60 dark:bg-white/[0.06] text-success-700 dark:text-success-300 border-success-500/40 hover:bg-success-500/15",
  excluir:
    "bg-white/60 dark:bg-white/[0.06] text-danger-700 dark:text-danger-300 border-danger-500/40 hover:bg-danger-500/15",
} as const;

const STATUS_BADGE_VARIANT: Record<CotacaoStatus, string> = {
  rascunho: "default",
  aberta: "enviada",
  fechada: "aceita",
  cancelada: "recusada",
};

/** Chave da seção "Sem grupo" — nunca colide com um uuid de grupo. */
const SEM_GRUPO = "__sem_grupo__";

const COLAPSADOS_STORAGE_KEY = "vendamais:cotacoes:grupos-colapsados";

interface Secao {
  /** `null` na seção "Sem grupo". */
  grupo: CotacaoGrupo | null;
  chave: string;
  cotacoes: CotacaoListItem[];
  /** Onde a seção começa dentro de `ordemVisivel` — é o que faz o índice do
   * card bater com o do arrasto quando o intervalo cruza dois grupos. */
  offset: number;
}

function lerColapsados(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COLAPSADOS_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function CotacoesListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cotacoes, setCotacoes] = useState<CotacaoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CotacaoListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrolledToRef = useRef<string | null>(null);

  /* ─── Seleção múltipla ─── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [emLote, setEmLote] = useState(false);
  const [confirmLote, setConfirmLote] = useState<null | "excluir" | "pausar" | "retomar">(null);

  /* ─── Grupos ─── */
  const [grupos, setGrupos] = useState<CotacaoGrupo[]>([]);
  const [gruposDisponiveis, setGruposDisponiveis] = useState(false);
  const [showAgruparModal, setShowAgruparModal] = useState(false);
  const [colapsados, setColapsados] = useState<Set<string>>(() => new Set());
  const [editandoGrupoId, setEditandoGrupoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [grupoParaExcluir, setGrupoParaExcluir] = useState<CotacaoGrupo | null>(null);
  const [excluindoGrupo, setExcluindoGrupo] = useState(false);

  // localStorage só é legível no cliente — ler no primeiro efeito evita
  // divergência de hidratação entre servidor e browser.
  useEffect(() => {
    setColapsados(lerColapsados());
  }, []);

  /**
   * Requisição em voo, para deduplicar chamadas simultâneas.
   *
   * O StrictMode do Next monta o efeito duas vezes em desenvolvimento, e a
   * tela abria com dois `GET /api/cotacoes` idênticos. Guardando a promise,
   * a segunda chamada aproveita a primeira em vez de bater no backend de
   * novo — e o mesmo vale para qualquer refresh disparado enquanto outro
   * ainda não voltou (ex.: uma ação em lote terminando junto do load).
   */
  const cotacoesEmVooRef = useRef<Promise<CotacaoListItem[]> | null>(null);

  const loadCotacoes = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const pedido = cotacoesEmVooRef.current ?? listarCotacoes();
      cotacoesEmVooRef.current = pedido;
      const data = await pedido;
      setCotacoes(data);
    } catch (error) {
      if (!opts?.silent) {
        setLoadError(error instanceof Error ? error.message : "Erro ao carregar cotações.");
      }
    } finally {
      cotacoesEmVooRef.current = null;
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  // Falha silenciosa de propósito: sem grupos a tela continua inteira, e um
  // toast de erro aqui só assustaria quem nem usa agrupamento.
  const gruposEmVooRef = useRef<ReturnType<typeof listarGruposCotacao> | null>(null);

  const loadGrupos = useCallback(async () => {
    try {
      // Mesma dedupe de `loadCotacoes` — o efeito de montagem chama os dois.
      const pedido = gruposEmVooRef.current ?? listarGruposCotacao();
      gruposEmVooRef.current = pedido;
      const { disponivel, grupos: lista } = await pedido;
      setGruposDisponiveis(disponivel);
      setGrupos(lista);
    } catch {
      setGruposDisponiveis(false);
      setGrupos([]);
    } finally {
      gruposEmVooRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadCotacoes();
    loadGrupos();
  }, [loadCotacoes, loadGrupos]);

  // Cotação recém-publicada (criada em /nova ou na lista de rascunho) chega aqui
  // via ?aberta=<id> — o card é rolado até a tela para dar feedback imediato.
  useEffect(() => {
    const abertaId = searchParams.get("aberta");
    if (!abertaId || loading || scrolledToRef.current === abertaId) return;
    const node = cardRefs.current.get(abertaId);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      scrolledToRef.current = abertaId;
    }
  }, [searchParams, loading, cotacoes]);

  const filtered = useMemo(() => {
    let result = cotacoes;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((c) => c.titulo.toLowerCase().includes(term));
    }
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }
    return result;
  }, [cotacoes, searchTerm, statusFilter]);

  // Status counts for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { "": cotacoes.length };
    for (const c of cotacoes) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [cotacoes]);

  /* ─── Seções (grupos) e ordem plana ───
   * `ordemVisivel` é a lista achatada na ordem em que os cards aparecem — é
   * ela que dá sentido a "arrastar do card A ao card F", inclusive quando o
   * intervalo atravessa dois grupos. */
  const { secoes, ordemVisivel } = useMemo(() => {
    if (!gruposDisponiveis) {
      return {
        secoes: [{ grupo: null, chave: SEM_GRUPO, cotacoes: filtered, offset: 0 }] as Secao[],
        ordemVisivel: filtered,
      };
    }

    const porGrupo = new Map<string, CotacaoListItem[]>();
    const semGrupo: CotacaoListItem[] = [];
    for (const cotacao of filtered) {
      if (cotacao.grupo_id) {
        const atual = porGrupo.get(cotacao.grupo_id);
        if (atual) atual.push(cotacao);
        else porGrupo.set(cotacao.grupo_id, [cotacao]);
      } else {
        semGrupo.push(cotacao);
      }
    }

    // Grupos vazios continuam na tela: é por eles que se renomeia/exclui um
    // grupo que ficou sem uso.
    const lista: Secao[] = [
      ...grupos.map((grupo) => ({
        grupo,
        chave: grupo.id,
        cotacoes: porGrupo.get(grupo.id) ?? [],
        offset: 0,
      })),
      { grupo: null, chave: SEM_GRUPO, cotacoes: semGrupo, offset: 0 },
    ];

    let acumulado = 0;
    for (const secao of lista) {
      secao.offset = acumulado;
      acumulado += secao.cotacoes.length;
    }

    return {
      secoes: lista,
      ordemVisivel: lista.flatMap((s) => s.cotacoes),
    };
  }, [filtered, grupos, gruposDisponiveis]);

  const selecionadas = useMemo(
    () => cotacoes.filter((c) => selectedIds.has(c.id)),
    [cotacoes, selectedIds],
  );
  const pausaveis = selecionadas.filter((c) => c.status === "aberta");
  const retomaveis = selecionadas.filter((c) => c.status === "fechada");
  // Excluir vale para qualquer status, inclusive 'fechada' (que é como o
  // produto representa "pausada") — ver deletarCotacao no backend.
  const excluiveis = selecionadas;

  const toggleSelecionada = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const limparSelecao = useCallback(() => setSelectedIds(new Set()), []);

  /* ─── Ctrl + arrastar ───
   * Mesmo desenho da tabela de produtos: `base` guarda a seleção de antes do
   * arrasto, para que voltar com o mouse desfaça o caminho percorrido. */
  const dragSelectRef = useRef<{ anchor: number; mode: "add" | "remove"; base: Set<string> } | null>(
    null,
  );
  const [isDragSelecting, setIsDragSelecting] = useState(false);

  const applySelectionRange = useCallback(
    (from: number, to: number, visiveis: CotacaoListItem[]) => {
      const info = dragSelectRef.current;
      if (!info) return;
      const [ini, fim] = from <= to ? [from, to] : [to, from];
      const next = new Set(info.base);
      for (const cotacao of visiveis.slice(ini, fim + 1)) {
        if (info.mode === "add") next.add(cotacao.id);
        else next.delete(cotacao.id);
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

  function toggleColapso(chave: string) {
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      try {
        window.localStorage.setItem(COLAPSADOS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Modo privado / storage cheio: colapso vira preferência só da sessão.
      }
      return next;
    });
  }

  async function handlePublish(cotacaoId: string) {
    setPublishingId(cotacaoId);
    try {
      const result = await publicarCotacaoPorId(cotacaoId);
      if (result.success) {
        toast.success("Cotação publicada com sucesso!");
        startTransition(() => {
          router.refresh();
        });
        loadCotacoes();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Erro ao publicar cotação.");
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deletarCotacao(deleteTarget.id);
      if (result.success) {
        toast.success("Cotação excluída.");
        setCotacoes((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.id);
          return next;
        });
        setDeleteTarget(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setDeleting(false);
    }
  }

  /**
   * Executa uma ação uma cotação por vez e reporta o resultado agregado.
   *
   * Sequencial de propósito: são chamadas de escrita no mesmo backend, e um
   * `Promise.all` de 30 itens só troca o tempo de espera por risco de
   * timeout. O erro de uma cotação não interrompe as outras — o toast final
   * diz quantas passaram e nomeia a primeira que falhou.
   */
  async function aplicarEmLote(
    alvos: CotacaoListItem[],
    acao: (cotacao: CotacaoListItem) => Promise<{ success: boolean; error?: string }>,
    sucessoLabel: (n: number) => string,
    // Os botões de pausar/retomar do próprio card reusam esta função, mas não
    // devem apagar uma seleção que o usuário montou para outra coisa.
    opts?: { manterSelecao?: boolean },
  ) {
    if (alvos.length === 0) return;
    setEmLote(true);
    let ok = 0;
    const falhas: string[] = [];

    for (const cotacao of alvos) {
      try {
        const result = await acao(cotacao);
        if (result.success) ok += 1;
        else falhas.push(`${cotacao.titulo}: ${result.error ?? "erro desconhecido"}`);
      } catch (error) {
        falhas.push(`${cotacao.titulo}: ${error instanceof Error ? error.message : "erro"}`);
      }
    }

    setEmLote(false);
    setConfirmLote(null);
    if (ok > 0) toast.success(sucessoLabel(ok));
    if (falhas.length > 0) {
      toast.error(
        falhas.length === 1
          ? falhas[0]
          : `${falhas.length} cotações não puderam ser processadas. Primeira: ${falhas[0]}`,
      );
    }

    if (!opts?.manterSelecao) limparSelecao();
    await loadCotacoes({ silent: true });
  }

  async function handleAgrupar(destino: DestinoGrupo) {
    const ids = selecionadas.map((c) => c.id);
    if (ids.length === 0) return;

    setEmLote(true);
    try {
      let grupoId: string | null = null;
      if (destino.tipo === "existente") {
        grupoId = destino.grupoId;
      } else if (destino.tipo === "novo") {
        const grupo = await criarGrupoCotacao(destino.nome);
        grupoId = grupo.id;
      }

      await atribuirGrupoCotacoes(ids, grupoId);

      toast.success(
        grupoId
          ? `${ids.length} ${ids.length === 1 ? "cotação movida" : "cotações movidas"} de grupo.`
          : `${ids.length} ${ids.length === 1 ? "cotação removida" : "cotações removidas"} do grupo.`,
      );
      setShowAgruparModal(false);
      limparSelecao();
      await Promise.all([loadGrupos(), loadCotacoes({ silent: true })]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao agrupar cotações.");
    } finally {
      setEmLote(false);
    }
  }

  async function salvarNomeGrupo(grupo: CotacaoGrupo) {
    const nome = nomeEdicao.trim();
    setEditandoGrupoId(null);
    if (!nome || nome === grupo.nome) return;

    try {
      await renomearGrupoCotacao(grupo.id, nome);
      await loadGrupos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao renomear o grupo.");
    }
  }

  async function handleExcluirGrupo() {
    if (!grupoParaExcluir) return;
    setExcluindoGrupo(true);
    try {
      await excluirGrupoCotacao(grupoParaExcluir.id);
      toast.success("Grupo excluído. As cotações voltaram para “Sem grupo”.");
      setGrupoParaExcluir(null);
      await Promise.all([loadGrupos(), loadCotacoes({ silent: true })]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir o grupo.");
    } finally {
      setExcluindoGrupo(false);
    }
  }

  const selecaoAtiva = selectedIds.size > 0;

  function renderCard(cotacao: CotacaoListItem, indiceGlobal: number) {
    const isActive = cotacao.status === "aberta";
    const isDraft = cotacao.status === "rascunho";
    const isPaused = cotacao.status === "fechada";
    const isPublishing = publishingId === cotacao.id;
    const selecionada = selectedIds.has(cotacao.id);

    return (
      <Card
        key={cotacao.id}
        ref={(el) => {
          if (el) cardRefs.current.set(cotacao.id, el);
          else cardRefs.current.delete(cotacao.id);
        }}
        // Ctrl/⌘ + clique seleciona em vez de navegar. O capture é necessário
        // porque o conteúdo do card é um <Link>: sem interceptar antes, o
        // navegador abriria a cotação numa aba nova.
        onClickCapture={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          // Sem isso o navegador começa a selecionar o texto dos cards.
          e.preventDefault();
          dragSelectRef.current = {
            anchor: indiceGlobal,
            mode: selecionada ? "remove" : "add",
            base: new Set(selectedIds),
          };
          setIsDragSelecting(true);
          applySelectionRange(indiceGlobal, indiceGlobal, ordemVisivel);
        }}
        onMouseEnter={() => {
          if (!dragSelectRef.current) return;
          applySelectionRange(dragSelectRef.current.anchor, indiceGlobal, ordemVisivel);
        }}
        className={cn(
          "group overflow-hidden transition-all duration-200",
          isDraft
            ? "border-warning-500/20 border-dashed"
            : isActive
              ? "border-primary-500/20"
              : "border-white/[0.06]",
          selecionada && "ring-2 ring-primary-500/50 border-primary-500/40",
        )}
      >
        <CardBody className="flex items-center justify-between p-5">
          <button
            type="button"
            onClick={() => toggleSelecionada(cotacao.id)}
            aria-pressed={selecionada}
            title={selecionada ? "Remover da seleção" : "Selecionar (ou Ctrl + clique no card)"}
            className={cn(
              "mr-3 shrink-0 h-5 w-5 rounded-md border flex items-center justify-center transition-all cursor-pointer",
              selecionada
                ? "bg-primary-500 border-primary-500 text-white"
                : "border-neutral-300 dark:border-white/20 text-transparent hover:border-primary-400",
              // Fora da seleção a caixinha só aparece no hover/foco, pra não
              // poluir a lista de quem nunca usa ação em lote.
              !selecionada && !selecaoAtiva && "opacity-0 group-hover:opacity-100 focus:opacity-100",
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>

          <Link href={`/empresario/cotacoes/${cotacao.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              {isActive && (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success-500" />
                </span>
              )}
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-200 truncate group-hover:text-primary-400 transition-colors">
                {cotacao.titulo}
              </h3>
              <Badge
                variant={(STATUS_BADGE_VARIANT[cotacao.status] ?? "default") as any}
                dot
              >
                {COTACAO_STATUS_LABELS[cotacao.status]}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5 font-medium text-neutral-400">
                {cotacao.itens.length} {cotacao.itens.length === 1 ? "item" : "itens"}
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-white/10 hidden sm:block" />
              <span
                className={`flex items-center gap-1.5 font-medium text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded-full ${
                  cotacao.propostas.length > 0 ? "animate-pulse" : ""
                }`}
              >
                {cotacao.propostas.length} propostas
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700 hidden sm:block" />
              <span>Criada em {formatDate(cotacao.created_at)}</span>
            </div>
          </Link>

          <div className="ml-4 flex items-center gap-2 shrink-0">
            {isDraft && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  handlePublish(cotacao.id);
                }}
                loading={isPublishing}
                disabled={isPublishing || isPending}
                className="h-8 px-3 text-xs bg-success-500/15 text-success-400 border border-success-500/25 hover:bg-success-500/25"
              >
                <Send className="h-3.5 w-3.5" />
                Publicar
              </Button>
            )}

            {/* Pausar/retomar individual — o mesmo par que a barra de seleção
                oferece em lote. */}
            {isActive && (
              <Tooltip label="Pausar: para de aceitar propostas (dá pra retomar depois)">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    aplicarEmLote([cotacao], (c) => encerrarCotacao(c.id), () => "Cotação pausada.", {
                      manterSelecao: true,
                    });
                  }}
                  disabled={emLote}
                  className="p-2 rounded-lg text-neutral-500 hover:text-warning-500 hover:bg-warning-500/10 transition-all cursor-pointer disabled:opacity-50"
                  title="Pausar cotação"
                >
                  <Pause className="h-4.5 w-4.5" />
                </button>
              </Tooltip>
            )}
            {isPaused && (
              <Tooltip label="Retomar: volta a aceitar propostas dos fornecedores">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    aplicarEmLote([cotacao], (c) => reabrirCotacao(c.id), () => "Cotação retomada.", {
                      manterSelecao: true,
                    });
                  }}
                  disabled={emLote}
                  className="p-2 rounded-lg text-neutral-500 hover:text-success-500 hover:bg-success-500/10 transition-all cursor-pointer disabled:opacity-50"
                  title="Retomar cotação"
                >
                  <Play className="h-4.5 w-4.5" />
                </button>
              </Tooltip>
            )}

            <Link
              href={`/empresario/cotacoes/${cotacao.id}`}
              className="flex items-center gap-1.5 text-neutral-500 hover:text-primary-400 transition-all p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.04]"
              title="Ver detalhes"
            >
              <span className="text-xs font-medium hidden sm:block">Ver detalhes</span>
              <Eye className="h-5 w-5" />
            </Link>

            {/* Sem gate de status: cotação pausada (= fechada) também pode ser
                excluída. A confirmação é quem segura a ação destrutiva. */}
            <Tooltip label="Excluir: apaga a cotação e as propostas recebidas">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setDeleteTarget(cotacao);
                }}
                className="p-2 rounded-lg text-neutral-500 hover:text-danger-500 hover:bg-danger-500/10 transition-all cursor-pointer"
                title="Excluir cotação"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </Tooltip>
          </div>
        </CardBody>
      </Card>
    );
  }

  function renderSecao(secao: Secao) {
    const colapsada = colapsados.has(secao.chave);
    const editando = secao.grupo != null && editandoGrupoId === secao.grupo.id;

    // Sem agrupamento (migration pendente) a lista é plana — não faz sentido
    // mostrar um cabeçalho "Sem grupo" sozinho.
    const semCabecalho = !gruposDisponiveis;

    return (
      <div key={secao.chave} className="space-y-3">
        {!semCabecalho && (
          <div className="group/secao flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => toggleColapso(secao.chave)}
              className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:text-primary-400 transition-colors cursor-pointer min-w-0"
            >
              {colapsada ? (
                <ChevronRight className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0" />
              )}
              {secao.grupo ? (
                <Folder className="h-4 w-4 shrink-0 text-primary-400" />
              ) : (
                <Inbox className="h-4 w-4 shrink-0 text-neutral-500" />
              )}
              {editando && secao.grupo ? null : (
                <span className="truncate">{secao.grupo ? secao.grupo.nome : "Sem grupo"}</span>
              )}
              <span className="text-xs font-normal text-neutral-500">({secao.cotacoes.length})</span>
            </button>

            {editando && secao.grupo && (
              <input
                autoFocus
                value={nomeEdicao}
                maxLength={60}
                onChange={(e) => setNomeEdicao(e.target.value)}
                onBlur={() => salvarNomeGrupo(secao.grupo!)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarNomeGrupo(secao.grupo!);
                  if (e.key === "Escape") setEditandoGrupoId(null);
                }}
                className="h-8 px-2 text-sm rounded-md bg-white dark:bg-neutral-900 border border-primary-400 text-neutral-900 dark:text-neutral-100 outline-none"
              />
            )}

            {secao.grupo && !editando && (
              <div className="flex items-center gap-1 opacity-0 group-hover/secao:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => {
                    setEditandoGrupoId(secao.grupo!.id);
                    setNomeEdicao(secao.grupo!.nome);
                  }}
                  title="Renomear grupo"
                  className="p-1.5 rounded-md text-neutral-500 hover:text-primary-400 hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setGrupoParaExcluir(secao.grupo)}
                  title="Excluir grupo (as cotações voltam para “Sem grupo”)"
                  className="p-1.5 rounded-md text-neutral-500 hover:text-danger-500 hover:bg-danger-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {!colapsada && (
          <div className="grid grid-cols-1 gap-3">
            {secao.cotacoes.length === 0 ? (
              <p className="text-xs text-neutral-500 italic pl-6">
                Nenhuma cotação neste grupo. Selecione cotações e use “Agrupar” para mover.
              </p>
            ) : (
              secao.cotacoes.map((cotacao, i) => renderCard(cotacao, secao.offset + i))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Minhas Cotações</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Gerencie suas solicitações e compare propostas
          </p>
        </div>
        <Link href="/empresario/cotacoes/nova">
          <Button>
            <Plus className="h-4 w-4" />
            Nova Cotação
          </Button>
        </Link>
      </div>

      {loading && <TableSkeleton showToolbar={false} columns={4} rows={5} />}

      {!loading && loadError && (
        <div className="text-center py-12">
          <p className="text-sm text-danger-400 mb-3">{loadError}</p>
          <Button variant="secondary" onClick={() => loadCotacoes()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {/* Filters */}
          {cotacoes.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Buscar por título..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] rounded-lg text-sm text-neutral-900 dark:text-white placeholder-neutral-500 outline-none focus:border-primary-500 transition-colors"
                />
              </div>
              {/* Status filter */}
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-white/[0.03] rounded-lg border border-neutral-200 dark:border-white/[0.06] p-0.5 overflow-x-auto">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      statusFilter === opt.value
                        ? "bg-primary-500/15 text-primary-400"
                        : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    {opt.label}
                    {(statusCounts[opt.value] ?? 0) > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          statusFilter === opt.value
                            ? "bg-primary-500/20 text-primary-300"
                            : "bg-neutral-200 dark:bg-white/[0.05] text-neutral-500 dark:text-neutral-600"
                        }`}
                      >
                        {statusCounts[opt.value]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dica de seleção — só enquanto nada está selecionado, some depois
              pra dar lugar à barra de ações. */}
          {cotacoes.length > 0 && !selecaoAtiva && (
            <p className="text-xs text-neutral-500">
              Dica: <kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/10">Ctrl</kbd>{" "}
              + clique (ou arraste) seleciona várias cotações para agrupar, pausar ou excluir de uma vez.
            </p>
          )}

          {/* Barra de ações em lote */}
          {selecaoAtiva && (
            <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-primary-500/30 bg-primary-500/10 backdrop-blur px-3 py-2">
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {selectedIds.size} {selectedIds.size === 1 ? "selecionada" : "selecionadas"}
              </span>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set(ordemVisivel.map((c) => c.id)))}
                className="text-xs text-neutral-500 hover:text-primary-400 underline underline-offset-2 cursor-pointer"
              >
                Selecionar todas ({ordemVisivel.length})
              </button>

              <div className="flex-1" />

              <Tooltip
                wide
                label={
                  gruposDisponiveis
                    ? "Move as cotações selecionadas para um grupo (ou cria um novo)."
                    : "Agrupamento indisponível: a migration 021_cotacao_grupos.sql ainda não foi aplicada no banco."
                }
              >
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!gruposDisponiveis || emLote}
                  onClick={() => setShowAgruparModal(true)}
                  className={cn("h-8 px-3 text-xs", ACAO_LOTE.agrupar)}
                >
                  <FolderInput className="h-3.5 w-3.5" />
                  Agrupar
                </Button>
              </Tooltip>

              {pausaveis.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={emLote}
                  onClick={() => setConfirmLote("pausar")}
                  className={cn("h-8 px-3 text-xs", ACAO_LOTE.pausar)}
                >
                  <Pause className="h-3.5 w-3.5" />
                  Pausar ({pausaveis.length})
                </Button>
              )}

              {retomaveis.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={emLote}
                  onClick={() => setConfirmLote("retomar")}
                  className={cn("h-8 px-3 text-xs", ACAO_LOTE.retomar)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Retomar ({retomaveis.length})
                </Button>
              )}

              {excluiveis.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={emLote}
                  onClick={() => setConfirmLote("excluir")}
                  className={cn("h-8 px-3 text-xs", ACAO_LOTE.excluir)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir ({excluiveis.length})
                </Button>
              )}

              <button
                type="button"
                onClick={limparSelecao}
                title="Limpar seleção"
                className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* List */}
          {filtered.length === 0 && cotacoes.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="Você ainda não tem cotações"
              description="Crie sua primeira cotação para receber propostas de fornecedores."
              action={
                <Link href="/empresario/cotacoes/nova">
                  <Button>Criar Nova Cotação</Button>
                </Link>
              }
            />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-sm">
              Nenhuma cotação encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="space-y-5">{secoes.map((secao) => renderSecao(secao))}</div>
          )}
        </>
      )}

      <AgruparCotacoesModal
        open={showAgruparModal}
        onClose={() => setShowAgruparModal(false)}
        grupos={grupos}
        quantidade={selectedIds.size}
        salvando={emLote}
        onConfirmar={handleAgrupar}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir cotação"
        description={
          deleteTarget && deleteTarget.propostas.length > 0
            ? `"${deleteTarget.titulo}" já recebeu ${deleteTarget.propostas.length} proposta(s) — excluí-la também apaga as propostas recebidas. Essa ação não pode ser desfeita.`
            : `Tem certeza que deseja excluir "${deleteTarget?.titulo}"? Essa ação não pode ser desfeita.`
        }
        confirmLabel="Sim, excluir"
        variant="danger"
        loading={deleting}
      />

      <ConfirmDialog
        open={confirmLote === "pausar"}
        onClose={() => setConfirmLote(null)}
        onConfirm={() =>
          aplicarEmLote(
            pausaveis,
            (c) => encerrarCotacao(c.id),
            (n) => `${n} ${n === 1 ? "cotação pausada" : "cotações pausadas"}.`,
          )
        }
        title="Pausar cotações"
        description={`${pausaveis.length} ${pausaveis.length === 1 ? "cotação deixa" : "cotações deixam"} de aceitar novas propostas. As propostas já recebidas continuam disponíveis, e dá para retomar depois.`}
        confirmLabel="Pausar"
        variant="warning"
        loading={emLote}
      />

      <ConfirmDialog
        open={confirmLote === "retomar"}
        onClose={() => setConfirmLote(null)}
        onConfirm={() =>
          aplicarEmLote(
            retomaveis,
            (c) => reabrirCotacao(c.id),
            (n) => `${n} ${n === 1 ? "cotação retomada" : "cotações retomadas"}.`,
          )
        }
        title="Retomar cotações"
        description={`${retomaveis.length} ${retomaveis.length === 1 ? "cotação volta" : "cotações voltam"} a aceitar propostas dos fornecedores convidados.`}
        confirmLabel="Retomar"
        variant="warning"
        loading={emLote}
      />

      <ConfirmDialog
        open={confirmLote === "excluir"}
        onClose={() => setConfirmLote(null)}
        onConfirm={() =>
          aplicarEmLote(
            excluiveis,
            (c) => deletarCotacao(c.id),
            (n) => `${n} ${n === 1 ? "cotação excluída" : "cotações excluídas"}.`,
          )
        }
        title="Excluir cotações"
        description={`${excluiveis.length} ${excluiveis.length === 1 ? "cotação será excluída" : "cotações serão excluídas"}, junto com as propostas já recebidas. Essa ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        variant="danger"
        loading={emLote}
      />

      <ConfirmDialog
        open={grupoParaExcluir != null}
        onClose={() => setGrupoParaExcluir(null)}
        onConfirm={handleExcluirGrupo}
        title="Excluir grupo"
        description={`O grupo “${grupoParaExcluir?.nome}” será apagado. Nenhuma cotação é excluída — elas voltam para “Sem grupo”.`}
        confirmLabel="Excluir grupo"
        variant="danger"
        loading={excluindoGrupo}
      />
    </div>
  );
}
