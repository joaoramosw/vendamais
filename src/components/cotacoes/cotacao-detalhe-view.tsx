"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileOutput,
  HelpCircle,
  Lock,
  MessageCircle,
  Package,
  Search,
  Send,
  Settings2,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { EditableNumberCell } from "@/components/ui/editable-number-cell";
import { DetailSkeleton } from "@/components/ui/skeletons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadColumnLabels, loadColumnOrder } from "@/components/ui/column-config-modal";
import {
  RESULTADO_COLUMNS,
  RESULTADO_COL_STORAGE_KEY,
  RESULTADO_DEFAULT_ORDER,
} from "@/lib/cotacao-resultado-columns";
import { Tooltip } from "@/components/ui/tooltip";
import { COTACAO_STATUS_LABELS } from "@/lib/constants";
import { propostaUrl } from "@/lib/routes";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { getMargemConfig } from "@/actions/margem";
import {
  calcularValorIdeal,
  DEFAULT_MARGEM_CONFIG,
  type MargemConfig,
} from "@/lib/margem";
import {
  atualizarItemCotacao,
  deletarCotacao,
  encerrarCotacao,
  getCotacaoDetalhe,
  getResultadoCotacao,
  listarConvites,
  publicarCotacaoPorId,
  type CotacaoItemRow,
  type CotacaoRow,
  type FornecedorConvidadoRow,
  type ItemResultado,
} from "@/lib/api/cotacoes-api";
import { ConviteWhatsAppModal } from "@/components/cotacoes/ConviteWhatsAppModal";
import { ExportarCotacaoModal } from "@/components/cotacoes/ExportarCotacaoModal";
import { ColocadoConteudo, identidadeFornecedor } from "@/components/cotacoes/RankingCell";
import { ProdutoItemIcone } from "@/components/cotacoes/ProdutoItemIcone";
import { contarObservacoesDeFornecedor } from "@/lib/cotacao-observacoes";
import { ItemQuickViewModal } from "@/components/cotacoes/ItemQuickViewModal";
import { ResultadoItemCard } from "@/components/cotacoes/ResultadoItemCard";
import { buildConviteCotacaoMessage, formatPhone, shareViaWhatsApp } from "@/lib/whatsapp";

const TODAS_EMPRESAS = "todas";

/**
 * Botões de ação do cabeçalho.
 *
 * `h-9` fixo: antes cada botão usava um `size` diferente (`icon`, `sm`,
 * padrão) e a linha ficava desalinhada. Com altura travada, o conteúdo pode
 * mudar (spinner do "loading", rótulo mais longo) sem mexer no alinhamento.
 *
 * No hover o botão inteiro se pinta na cor da ação e ícone + texto ficam
 * brancos — os ícones do lucide usam `currentColor`, então `hover:text-white`
 * já cobre os dois.
 */
const ACAO_BASE = "h-9 px-3 gap-1.5 whitespace-nowrap";

/**
 * Cor de cada ação. Usado sempre com `variant="outline"`, que não traz cor
 * nenhuma — então estas classes são a única fonte de fundo, texto e borda, e
 * não dependem de vencer nenhum padrão do Button.
 *
 * As quatro entradas têm exatamente a mesma forma; só muda a cor. Ícone segue
 * o texto sozinho (lucide usa `currentColor`), por isso `hover:text-white`
 * deixa ícone e rótulo brancos. Se adicionar uma quinta ação, copie a forma.
 */
const ACAO_COR = {
  ajustes:
    "bg-info-50 text-info-700 border-info-500/40 hover:bg-info-600 hover:text-white hover:border-info-600 active:bg-info-700 " +
    "dark:bg-info-500/10 dark:text-info-300 dark:border-info-500/30",
  exportar:
    "bg-success-50 text-success-700 border-success-600/40 hover:bg-success-700 hover:text-white hover:border-success-700 active:bg-success-800 " +
    "dark:bg-success-500/10 dark:text-success-300 dark:border-success-500/30",
  encerrar:
    "bg-warning-50 text-warning-700 border-warning-600/40 hover:bg-warning-700 hover:text-white hover:border-warning-700 active:bg-warning-800 " +
    "dark:bg-warning-500/10 dark:text-warning-300 dark:border-warning-500/30",
  excluir:
    "bg-danger-50 text-danger-700 border-danger-500/40 hover:bg-danger-600 hover:text-white hover:border-danger-600 active:bg-danger-700 " +
    "dark:bg-danger-500/10 dark:text-danger-300 dark:border-danger-500/30",
} as const;

/** Enquanto a cotação está aberta, o resultado é atualizado por polling
 * silencioso (sem infra de push/websocket disponível hoje) — intervalo
 * pensado pra parecer "ao vivo" sem sobrecarregar o backend. */
const POLL_INTERVAL_MS = 10_000;

const CONVITE_STATUS_LABELS: Record<FornecedorConvidadoRow["status_convite"], string> = {
  pendente: "Aguardando abertura",
  visualizado: "Visualizado",
  respondido: "Respondeu",
};

/** Reexportado do módulo compartilhado do ranking — desktop e mobile usam a
 * mesma regra de identificação do fornecedor. */
const identidade = identidadeFornecedor;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Dot pulsante discreto — mesma linguagem visual do indicador "aberta" da
 * listagem de cotações — usado aqui pra sinalizar atualização em tempo real. */
function AoVivoIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success-500">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
      </span>
      Ao vivo
    </span>
  );
}

/** Porcentagem no formato pt-BR (28.5 → "28,5%"). */
function percent(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/**
 * Texto do tooltip da coluna de preço. Vive aqui (e não numa string solta)
 * porque a explicação depende da margem configurada em Ajustes — escrever
 * "28,5%" fixo no texto seria mentira assim que alguém mudar a config
 * (ver "O que NÃO fazer" no CLAUDE.md).
 */
function ExplicacaoPrecoLoja({ config }: { config: MargemConfig }) {
  return (
    <>
      <strong className="font-semibold">Preço loja</strong> é por quanto você vende este produto
      hoje (vem do cadastro do produto).
      <br />
      Logo abaixo vem o <strong className="font-semibold">preço ideal de compra</strong>: o máximo
      que dá pra pagar ao fornecedor mantendo sua margem de {percent(config.margem_percent)}.
    </>
  );
}

function ExplicacaoPrecoIdeal({ config }: { config: MargemConfig }) {
  return (
    <>
      <strong className="font-semibold">Preço ideal de compra</strong>: o máximo a pagar ao
      fornecedor para manter sua margem de {percent(config.margem_percent)} sobre o preço de loja.
      <br />
      As setas nos colocados comparam a oferta com este valor — para baixo (verde) é mais barato
      que o ideal, para cima (vermelho) é mais caro.
    </>
  );
}

export function CotacaoDetalheView({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cotacao, setCotacao] = useState<CotacaoRow | null>(null);
  const [itensDetalhe, setItensDetalhe] = useState<CotacaoItemRow[]>([]);
  const [itensResultado, setItensResultado] = useState<ItemResultado[] | null>(null);
  const [convites, setConvites] = useState<FornecedorConvidadoRow[]>([]);

  const [publicando, setPublicando] = useState(false);
  const [showConviteModal, setShowConviteModal] = useState(false);
  const [showEncerrarDialog, setShowEncerrarDialog] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [showExcluirDialog, setShowExcluirDialog] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [mostrarInterno, setMostrarInterno] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  // Ordem/rótulos das colunas são editados na página de Ajustes
  // (/empresario/ajustes) e persistidos em localStorage; aqui só lemos, na
  // montagem — voltar da página de ajustes remonta esta view e traz o valor
  // novo.
  const [columnOrder] = useState<string[]>(() =>
    loadColumnOrder(RESULTADO_COL_STORAGE_KEY, RESULTADO_DEFAULT_ORDER)
  );
  const [columnLabels] = useState<Record<string, string>>(() =>
    loadColumnLabels(RESULTADO_COL_STORAGE_KEY)
  );

  /** Config de margem (Ajustes → Margem e cálculo). Começa no padrão do
   * sistema pra tabela nunca ficar esperando a leitura — se o banco tiver
   * outro valor, ele chega logo depois e re-renderiza. */
  const [margemConfig, setMargemConfig] = useState<MargemConfig>(DEFAULT_MARGEM_CONFIG);

  /** Cards expandidos no mobile. Set (não id único) porque a especificação
   * permite várias linhas abertas ao mesmo tempo — não é accordion exclusivo. */
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());

  /** Item aberto no acesso rápido (modal). Guardamos só o id: o objeto vem do
   * `itensResultado` corrente, então o polling silencioso atualiza o que está
   * aberto em vez de congelar uma cópia. */
  const [itemRapidoId, setItemRapidoId] = useState<string | null>(null);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState(TODAS_EMPRESAS);
  const [somentePrimeirosColocados, setSomentePrimeirosColocados] = useState(false);
  const [apenasPrimeiroColocado, setApenasPrimeiroColocado] = useState(false);
  const [mostrarQuantidadeEstoque, setMostrarQuantidadeEstoque] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleExpandido = useCallback((itemId: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const loadAll = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const detalhe = await getCotacaoDetalhe(id);
        setCotacao(detalhe.cotacao);
        setItensDetalhe(detalhe.itens);

        if (detalhe.cotacao.status === "aberta" || detalhe.cotacao.status === "fechada") {
          const [resultado, convitesData] = await Promise.all([
            getResultadoCotacao(id),
            listarConvites(id),
          ]);
          setItensResultado(resultado.itens);
          setConvites(convitesData);
        } else {
          setItensResultado(null);
          setConvites([]);
        }
      } catch (err) {
        if (!opts?.silent) {
          setError(err instanceof Error ? err.message : "Erro ao carregar cotação.");
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Config de margem: leitura única na montagem. Falha silenciosa de
  // propósito — a action já devolve o padrão do sistema em caso de erro, e
  // um toast aqui só atrapalharia quem só quer ver o ranking.
  useEffect(() => {
    let ativo = true;
    getMargemConfig().then(({ config }) => {
      if (ativo) setMargemConfig(config);
    });
    return () => {
      ativo = false;
    };
  }, []);

  // Enquanto a cotação está aberta, atualiza o resultado silenciosamente em
  // segundo plano — dá a sensação de "tempo real" sem depender de push.
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (cotacao?.status !== "aberta") return;

    pollRef.current = setInterval(() => {
      loadAll({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [cotacao?.status, loadAll]);

  async function handlePublicar() {
    setPublicando(true);
    try {
      const result = await publicarCotacaoPorId(id);
      if (result.success) {
        toast.success("Cotação publicada!");
        loadAll();
      } else {
        toast.error(result.error);
      }
    } finally {
      setPublicando(false);
    }
  }

  function copiarLink(token: string) {
    navigator.clipboard.writeText(propostaUrl(token));
    toast.success("Link copiado!");
  }

  function compartilharConvite(convite: FornecedorConvidadoRow) {
    shareViaWhatsApp(
      buildConviteCotacaoMessage({
        fornecedorNome: convite.nome_empresa,
        cotacaoTitulo: cotacao?.titulo ?? "",
        link: propostaUrl(convite.token_acesso),
        totalItens: itensDetalhe.length,
        dataLimite: cotacao?.data_limite,
      }),
      convite.whatsapp,
    );
  }

  async function handleEncerrar() {
    setEncerrando(true);
    try {
      const result = await encerrarCotacao(id);
      if (result.success) {
        toast.success("Cotação encerrada! O resultado final já está disponível.");
        setShowEncerrarDialog(false);
        loadAll();
      } else {
        toast.error(result.error);
      }
    } finally {
      setEncerrando(false);
    }
  }

  async function handleExcluir() {
    setExcluindo(true);
    try {
      const result = await deletarCotacao(id);
      if (result.success) {
        toast.success("Cotação excluída.");
        router.push("/empresario/cotacoes");
      } else {
        toast.error(result.error);
        setExcluindo(false);
      }
    } catch {
      setExcluindo(false);
    }
  }

  async function handleQuantidadeSugeridaChangeDetalhe(itemId: string, value: number) {
    const anterior = itensDetalhe;
    setItensDetalhe((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantidade_sugerida: value } : item)),
    );
    try {
      await atualizarItemCotacao(id, itemId, { quantidade_sugerida: value });
    } catch (err) {
      setItensDetalhe(anterior);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar sugestão.");
    }
  }

  // Empresas que participaram de pelo menos 1 item — pra popular o filtro.
  const empresas = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const item of itensResultado ?? []) {
      for (const entry of item.ranking) {
        const key = entry.fornecedor_convidado_id;
        if (!vistos.has(key)) vistos.set(key, identidade(entry));
      }
    }
    return [...vistos.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [itensResultado]);

  const itensExibidos = useMemo(() => {
    let result = itensResultado ?? [];

    const termo = buscaProduto.trim();
    if (termo) {
      const termoNormalizado = normalizar(termo);
      result = result.filter((item) => normalizar(item.nome_produto).includes(termoNormalizado));
    }

    if (empresaFiltro !== TODAS_EMPRESAS) {
      result = result.filter((item) => {
        const participou = item.ranking.some((e) => e.fornecedor_convidado_id === empresaFiltro);
        if (!participou) return false;
        if (!somentePrimeirosColocados) return true;
        return item.ranking[0]?.fornecedor_convidado_id === empresaFiltro;
      });
    }

    return result;
  }, [itensResultado, buscaProduto, empresaFiltro, somentePrimeirosColocados]);

  /** `cotacao_itens` por id — o resultado por item não carrega unidade,
   * categoria nem `product_id`, que o acesso rápido precisa mostrar. */
  const detalhePorItemId = useMemo(
    () => new Map(itensDetalhe.map((linha) => [linha.id, linha])),
    [itensDetalhe],
  );

  const itemRapido = useMemo(
    () => (itensResultado ?? []).find((i) => i.cotacao_item_id === itemRapidoId) ?? null,
    [itensResultado, itemRapidoId],
  );

  const filtrosAtivos =
    buscaProduto.trim() !== "" || empresaFiltro !== TODAS_EMPRESAS || apenasPrimeiroColocado;

  function limparFiltros() {
    setBuscaProduto("");
    setEmpresaFiltro(TODAS_EMPRESAS);
    setSomentePrimeirosColocados(false);
    setApenasPrimeiroColocado(false);
  }

  if (loading) {
    return <DetailSkeleton sections={2} />;
  }

  if (error || !cotacao) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-danger-400 mb-3">{error ?? "Cotação não encontrada."}</p>
        <Button variant="secondary" onClick={() => loadAll()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const temResultado = cotacao.status === "aberta" || cotacao.status === "fechada";
  const respondidos = convites.filter((c) => c.status_convite === "respondido").length;

  const colunasVisiveis = columnOrder.filter((colId) => {
    if ((colId === "segundo" || colId === "terceiro") && apenasPrimeiroColocado) return false;
    if ((colId === "estoque" || colId === "sugestao") && !mostrarQuantidadeEstoque) return false;
    return true;
  });

  function renderHeaderCell(colId: string) {
    const col = RESULTADO_COLUMNS.find((c) => c.id === colId);
    if (!col) return null;
    const label = columnLabels[colId] ?? col.label;
    const width =
      {
        produto: undefined,
        primeiro: "w-48",
        segundo: "w-40",
        terceiro: "w-40",
        preco: "w-32",
        estoque: "w-24",
        sugestao: "w-24",
      }[colId] ?? undefined;

    // A coluna de preço é a única que junta dois números de origens
    // diferentes (o que você vende × o que deveria pagar) — sem explicação
    // ela é lida como "dois preços do fornecedor". `side="bottom"` porque o
    // cabeçalho costuma ficar colado no topo da área visível.
    //
    // As células do corpo não têm mais tooltip nenhum (decisão de produto:
    // tooltip só no cabeçalho), então este aqui carrega as duas explicações
    // — a do preço de loja e a do preço ideal de compra.
    if (colId === "preco") {
      return (
        <TableHead key={colId} className={width}>
          <Tooltip
            wide
            side="bottom"
            label={
              <>
                <ExplicacaoPrecoLoja config={margemConfig} />
                <br />
                <br />
                <ExplicacaoPrecoIdeal config={margemConfig} />
              </>
            }
          >
            <span className="inline-flex items-center gap-1 cursor-help">
              {label}
              <HelpCircle className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
            </span>
          </Tooltip>
        </TableHead>
      );
    }

    return (
      <TableHead key={colId} className={width}>
        {label}
      </TableHead>
    );
  }

  /** Valor ideal de compra do item — mesma função pura do mobile. Cada
   * fornecedor do ranking é avaliado individualmente contra este número. */
  function valorIdealDoItem(item: ItemResultado): number | null {
    return calcularValorIdeal(item.preco_loja, margemConfig.margem_percent, margemConfig.metodo);
  }

  function renderBodyCell(colId: string, item: ItemResultado) {
    const [primeiro, segundo, terceiro] = item.ranking;
    const valorIdeal = valorIdealDoItem(item);
    switch (colId) {
      case "produto":
        return (
          <TableCell key={colId}>
            {/* Mesma divisão de interação da tela de produtos (gotcha #22):
                clicar no nome abre o acesso rápido; o ícone ao lado leva pro
                acesso completo, numa página própria.

                Sem Tooltip aqui: no corpo da tabela a explicação ficou só no
                `title` nativo — os tooltips ricos vivem no cabeçalho. */}
            <div className="flex items-center gap-2">
              <ProdutoItemIcone totalObservacoes={contarObservacoesDeFornecedor(item)} />
              <button
                type="button"
                onClick={() => setItemRapidoId(item.cotacao_item_id)}
                className="font-medium text-left text-neutral-800 dark:text-neutral-200 hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors cursor-pointer"
              >
                {item.nome_produto}
              </button>
              <Link
                href={`/empresario/cotacoes/${id}/itens/${item.cotacao_item_id}`}
                aria-label={`Abrir detalhe completo de ${item.nome_produto}`}
                className="p-1 rounded-md text-neutral-500 hover:text-primary-500 hover:bg-primary-500/10 transition-colors shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            {item.indisponiveis.length > 0 && (
              <p className="text-[11px] text-neutral-500 italic mt-0.5 pl-[22px]">
                Não tem: {item.indisponiveis.map((f) => identidade(f)).join(", ")}
              </p>
            )}
          </TableCell>
        );
      case "primeiro":
      case "segundo":
      case "terceiro": {
        const porPosicao = { primeiro: [primeiro, 1], segundo: [segundo, 2], terceiro: [terceiro, 3] } as const;
        const [entry, posicao] = porPosicao[colId];
        return (
          <TableCell key={colId}>
            <ColocadoConteudo
              entry={entry}
              posicao={posicao}
              cotacaoTitulo={cotacao!.titulo}
              valorIdeal={valorIdeal}
              toleranciaPercent={margemConfig.tolerancia_percent}
            />
          </TableCell>
        );
      }
      case "preco":
        return (
          <TableCell key={colId}>
            {/* Sem Tooltip: a explicação dos dois números (o que você vende ×
                o que deveria pagar) subiu inteira para o cabeçalho da coluna,
                que é onde os tooltips ficaram concentrados. */}
            {item.preco_loja != null ? (
              <div className="min-w-0">
                <span className="text-sm font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
                  {formatCurrency(item.preco_loja)}
                </span>
                {/* Preço ideal de compra logo abaixo: é a referência contra a
                    qual cada indicador de tendência da linha foi decidido —
                    sem ele o usuário vê a seta e não sabe de onde ela saiu. */}
                <p className="text-[11px] text-neutral-500 tabular-nums">
                  ideal de compra{" "}
                  {valorIdeal != null ? formatCurrency(valorIdeal) : "—"}
                </p>
              </div>
            ) : (
              <span className="text-neutral-500">—</span>
            )}
          </TableCell>
        );
      case "estoque":
        return (
          <TableCell key={colId} className="text-neutral-600 dark:text-neutral-400">
            {item.estoque_atual ?? "—"}
          </TableCell>
        );
      case "sugestao":
        // Fixo de propósito no resultado: aqui a sugestão é referência de
        // leitura (é a quantidade que multiplica o preço ofertado nos
        // subtotais). Quem precisa ajustá-la faz isso na cotação em rascunho,
        // antes de publicar.
        return (
          <TableCell key={colId} className="text-neutral-600 dark:text-neutral-400 tabular-nums">
            {item.quantidade_sugerida ?? "—"}
          </TableCell>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          href="/empresario/cotacoes"
          className="p-2 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white">{cotacao.titulo}</h1>
            <Badge variant="default" dot>
              {COTACAO_STATUS_LABELS[cotacao.status]}
            </Badge>
            {cotacao.status === "aberta" && <AoVivoIndicator />}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Criada em {formatDate(cotacao.created_at)}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {itensDetalhe.length} {itensDetalhe.length === 1 ? "item" : "itens"}
            {temResultado && (
              <>
                {" "}
                · {respondidos} {respondidos === 1 ? "fornecedor respondeu" : "fornecedores responderam"}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {temResultado && (
            <Tooltip label="Colunas do resultado, margem e cálculo do valor ideal">
              {/* Link, não Button: os ajustes deixaram de ser um modal e
                  viraram página própria (/empresario/ajustes). O visual
                  continua o mesmo via buttonVariants. */}
              <Link
                href="/empresario/ajustes"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  ACAO_BASE,
                  ACAO_COR.ajustes,
                )}
              >
                <Settings2 className="h-4 w-4" />
                Markup
              </Link>
            </Tooltip>
          )}
          {temResultado && (
            <Tooltip label="Baixar o resultado em Excel ou PDF">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportModal(true)}
                className={cn(ACAO_BASE, ACAO_COR.exportar)}
              >
                <FileOutput className="h-4 w-4" />
                Exportar
              </Button>
            </Tooltip>
          )}
          {cotacao.status === "aberta" && (
            <Tooltip label="Para de aceitar propostas e fecha o resultado">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEncerrarDialog(true)}
                className={cn(ACAO_BASE, ACAO_COR.encerrar)}
              >
                <Lock className="h-4 w-4" />
                Encerrar cotação
              </Button>
            </Tooltip>
          )}
          {cotacao.status === "rascunho" && (
            <Tooltip label="Publicar e liberar para os fornecedores responderem">
              <Button
                size="sm"
                onClick={handlePublicar}
                loading={publicando}
                disabled={publicando}
                className={ACAO_BASE}
              >
                <Send className="h-4 w-4" />
                Publicar
              </Button>
            </Tooltip>
          )}
          {/* Sem gate de status: cotação fechada (o "pausada" do produto)
              também pode ser excluída — ver deletarCotacao no backend. */}
          <Tooltip label="Apaga a cotação e as propostas já recebidas">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExcluirDialog(true)}
              className={cn(ACAO_BASE, ACAO_COR.excluir)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir cotação
            </Button>
          </Tooltip>
        </div>
      </div>

      <ConfirmDialog
        open={showEncerrarDialog}
        onClose={() => setShowEncerrarDialog(false)}
        onConfirm={handleEncerrar}
        title="Encerrar cotação"
        description="Depois de encerrada, a cotação não aceita mais propostas e o resultado por item (vencedor, 2º e 3º colocado) fica disponível pra consulta. Essa ação não pode ser desfeita. Tem certeza que deseja encerrar?"
        confirmLabel="Sim, encerrar"
        variant="warning"
        loading={encerrando}
      />

      <ConfirmDialog
        open={showExcluirDialog}
        onClose={() => setShowExcluirDialog(false)}
        onConfirm={handleExcluir}
        title="Excluir cotação"
        description={
          convites.length > 0
            ? `"${cotacao.titulo}" já recebeu propostas — excluí-la também apaga as propostas recebidas. Essa ação não pode ser desfeita. Tem certeza que deseja excluir?`
            : `Tem certeza que deseja excluir "${cotacao.titulo}"? Essa ação não pode ser desfeita.`
        }
        confirmLabel="Sim, excluir"
        variant="danger"
        loading={excluindo}
      />

      {temResultado && (
        <ExportarCotacaoModal
          open={showExportModal}
          cotacaoId={id}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {!temResultado ? (
        /* ─── Rascunho / cancelada: só a lista de itens, sem ranking (a
           cotação ainda não foi publicada, não há propostas possíveis) ─── */
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-300">Itens ({itensDetalhe.length})</h2>
              <button
                type="button"
                onClick={() => setMostrarInterno((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 px-2 py-1 rounded-md hover:bg-white/[0.04] transition-colors cursor-pointer"
                title={mostrarInterno ? "Ocultar estoque e sugestão" : "Mostrar estoque e sugestão"}
              >
                {mostrarInterno ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {mostrarInterno ? "Ocultar internos" : "Mostrar internos"}
              </button>
            </div>
            <div className="space-y-2">
              {itensDetalhe.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-sm text-neutral-400 border-b border-white/[0.04] pb-2 last:border-0"
                >
                  <Package className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                  <span className="text-neutral-300 flex-1">{item.nome_produto}</span>
                  <span className="text-xs text-neutral-500">
                    {item.quantidade} {item.unidade}
                  </span>
                  {mostrarInterno && (
                    <div className="flex items-center gap-3 text-xs text-neutral-500 shrink-0">
                      <span>Estoque: {item.estoque_atual ?? "—"}</span>
                      <span className="flex items-center gap-1.5">
                        Sugestão:
                        {cotacao.status === "cancelada" ? (
                          <span className="text-neutral-400">{item.quantidade_sugerida ?? "—"}</span>
                        ) : (
                          <EditableNumberCell
                            value={item.quantidade_sugerida ?? 0}
                            min={0}
                            onChange={(v) => handleQuantidadeSugeridaChangeDetalhe(item.id, v)}
                          />
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {mostrarInterno && itensDetalhe.length > 0 && (
              <p className="text-[11px] text-neutral-600 italic mt-3">
                Estoque e sugestão são internos — não aparecem para o fornecedor.
              </p>
            )}
          </CardBody>
        </Card>
      ) : (
        <>
          {/* ─── Convites — condensado (chips), com ação de convidar só
             enquanto a cotação ainda aceita propostas ─── */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-300">Fornecedores convidados</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {convites.length === 0
                      ? "Nenhum fornecedor convidado ainda."
                      : `${convites.length} convidado${convites.length === 1 ? "" : "s"} · ${respondidos} responderam`}
                  </p>
                </div>
                {cotacao.status === "aberta" && (
                  <Button type="button" size="sm" onClick={() => setShowConviteModal(true)}>
                    <Users className="h-4 w-4" />
                    Convidar
                  </Button>
                )}
              </div>

              {convites.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {convites.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 text-xs bg-white/[0.03] border border-white/[0.06] rounded-full pl-3 pr-1.5 py-1"
                    >
                      <span className="text-neutral-300">
                        {c.nome_empresa ||
                          (c.whatsapp ? formatPhone(c.whatsapp) : c.email_contato) ||
                          "Sem contato"}
                      </span>
                      <span className="text-neutral-600">·</span>
                      <span className="text-neutral-500">{CONVITE_STATUS_LABELS[c.status_convite]}</span>
                      {c.whatsapp && (
                        <button
                          onClick={() => compartilharConvite(c)}
                          title="Contatar via WhatsApp"
                          className="p-1 rounded-full text-success-400 hover:bg-success-500/10 transition-colors cursor-pointer"
                        >
                          <MessageCircle className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => copiarLink(c.token_acesso)}
                        title="Copiar link do convite"
                        className="p-1 rounded-full text-primary-400 hover:bg-primary-500/10 transition-colors cursor-pointer"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <ConviteWhatsAppModal
            open={showConviteModal}
            cotacaoId={id}
            cotacaoTitulo={cotacao.titulo}
            totalItens={itensDetalhe.length}
            dataLimite={cotacao.data_limite}
            onClose={() => setShowConviteModal(false)}
            onInvited={() => loadAll()}
          />

          {/* ─── Resultado por item ─── */}
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-warning-400 shrink-0" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Resultado por item</h2>
          </div>

          {empresas.length > 0 && (
            <Card>
              <CardBody className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Buscar produto
                    </label>
                    <div className="relative mt-1.5">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input
                        type="text"
                        placeholder="Nome do produto..."
                        value={buscaProduto}
                        onChange={(e) => setBuscaProduto(e.target.value)}
                        className="w-full h-[42px] pl-9 pr-9 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                      />
                      {buscaProduto && (
                        <button
                          type="button"
                          onClick={() => setBuscaProduto("")}
                          title="Limpar busca"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <Select
                      label="Filtrar por fornecedor"
                      value={empresaFiltro}
                      onChange={(e) => setEmpresaFiltro(e.target.value)}
                      options={[
                        { value: TODAS_EMPRESAS, label: "Todas as empresas" },
                        ...empresas.map((e) => ({ value: e.key, label: e.label })),
                      ]}
                    />
                  </div>
                  {filtrosAtivos && (
                    <button
                      type="button"
                      onClick={limparFiltros}
                      className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 pb-2.5 cursor-pointer transition-colors shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                      Limpar filtros
                    </button>
                  )}
                </div>

                {empresaFiltro !== TODAS_EMPRESAS && (
                  <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={somentePrimeirosColocados}
                      onChange={(e) => setSomentePrimeirosColocados(e.target.checked)}
                      className="rounded border-white/20 bg-white/[0.05]"
                    />
                    Mostrar apenas itens em que esse fornecedor é o 1º colocado
                  </label>
                )}

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 border-t border-neutral-100 dark:border-white/[0.06]">
                  <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={apenasPrimeiroColocado}
                      onChange={(e) => setApenasPrimeiroColocado(e.target.checked)}
                      className="rounded border-white/20 bg-white/[0.05]"
                    />
                    Ver apenas o 1º colocado de cada produto
                  </label>
                  <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mostrarQuantidadeEstoque}
                      onChange={(e) => setMostrarQuantidadeEstoque(e.target.checked)}
                      className="rounded border-white/20 bg-white/[0.05]"
                    />
                    Mostrar estoque e sugestão
                  </label>
                </div>
              </CardBody>
            </Card>
          )}

          {itensExibidos.length === 0 ? (
            <Card>
              <CardBody className="p-12 text-center text-neutral-500 space-y-3">
                <p>
                  {buscaProduto.trim()
                    ? `Nenhum produto encontrado para "${buscaProduto.trim()}".`
                    : "Nenhum item corresponde ao filtro selecionado."}
                </p>
                {filtrosAtivos && (
                  <Button variant="secondary" size="sm" onClick={limparFiltros}>
                    Limpar filtros
                  </Button>
                )}
              </CardBody>
            </Card>
          ) : (
            <>
              {/* Desktop (≥ md): tabela tradicional, três colocações lado a lado. */}
              <Card className="overflow-hidden hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>{colunasVisiveis.map((colId) => renderHeaderCell(colId))}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensExibidos.map((item) => (
                      <TableRow key={item.cotacao_item_id}>
                        {colunasVisiveis.map((colId) => renderBodyCell(colId, item))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {/* Mobile (< md): a mesma informação em cards colapsáveis — sem
                  scroll horizontal, sem perder dado (ver ResultadoItemCard). */}
              <Card className="overflow-hidden md:hidden">
                {itensExibidos.map((item) => (
                  <ResultadoItemCard
                    key={item.cotacao_item_id}
                    item={item}
                    cotacaoTitulo={cotacao.titulo}
                    valorIdeal={valorIdealDoItem(item)}
                    toleranciaPercent={margemConfig.tolerancia_percent}
                    margemPercent={margemConfig.margem_percent}
                    expandido={expandidos.has(item.cotacao_item_id)}
                    onToggle={() => toggleExpandido(item.cotacao_item_id)}
                    apenasPrimeiroColocado={apenasPrimeiroColocado}
                    mostrarQuantidadeEstoque={mostrarQuantidadeEstoque}
                    onAcessoRapido={() => setItemRapidoId(item.cotacao_item_id)}
                    hrefDetalhe={`/empresario/cotacoes/${id}/itens/${item.cotacao_item_id}`}
                  />
                ))}
              </Card>
            </>
          )}

          <ItemQuickViewModal
            item={itemRapido}
            detalhe={itemRapido ? detalhePorItemId.get(itemRapido.cotacao_item_id) ?? null : null}
            cotacaoId={id}
            cotacaoTitulo={cotacao.titulo}
            valorIdeal={itemRapido ? valorIdealDoItem(itemRapido) : null}
            toleranciaPercent={margemConfig.tolerancia_percent}
            onClose={() => setItemRapidoId(null)}
          />
        </>
      )}
    </div>
  );
}
