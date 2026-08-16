"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import {
  detalharMinhaProposta,
  listarMinhasPropostas,
  type MinhaProposta,
  type MinhaPropostaDetalhe,
} from "@/lib/api/fornecedor-api";
import { PropostaItemRow } from "@/components/propostas/PropostaItemRow";
import { PROPOSTA_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Inbox,
  Loader2,
  Package,
  XCircle,
} from "lucide-react";

const STATUS_ICON: Record<string, React.ElementType> = {
  rascunho: Clock,
  enviada: Clock,
  aceita: CheckCircle2,
  recusada: XCircle,
};

const STATUS_COLOR: Record<string, "default" | "warning" | "aceita" | "recusada"> = {
  rascunho: "default",
  enviada: "warning",
  aceita: "aceita",
  recusada: "recusada",
};

export function MinhasPropostasClient({
  initialStatus,
  initialAbertaId,
}: {
  initialStatus?: string;
  initialAbertaId?: string;
}) {
  const [propostas, setPropostas] = useState<MinhaProposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus ?? "todas");

  const [detalhe, setDetalhe] = useState<MinhaPropostaDetalhe | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  /** Item aberto na lista do modal — expansão inline, um por vez. */
  const [itemExpandido, setItemExpandido] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPropostas(await listarMinhasPropostas());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar propostas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (initialAbertaId) {
      openDetalhe(initialAbertaId);
    }
  }, [initialAbertaId]);

  async function openDetalhe(id: string) {
    setDetalhe(null);
    setDetailError(null);
    setItemExpandido(null);
    setDetailLoading(true);
    try {
      setDetalhe(await detalharMinhaProposta(id));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Erro ao carregar a proposta.");
    } finally {
      setDetailLoading(false);
    }
  }

  const filtered =
    statusFilter === "todas"
      ? propostas
      : propostas.filter((p) => p.status === statusFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Minhas Propostas
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            Acompanhe o status das suas propostas
          </p>
        </div>

        {propostas.length > 0 && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar por status"
            className="w-full sm:w-auto border rounded-[var(--radius-md)] px-3 py-2 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border-neutral-200 dark:border-white/10 outline-none cursor-pointer"
          >
            <option value="todas">Todas</option>
            {Object.entries(PROPOSTA_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-neutral-500 dark:text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando...
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-12">
          <p className="text-sm text-danger-400 mb-3">{error}</p>
          <Button variant="secondary" onClick={load}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!loading && !error && propostas.length === 0 && (
        <EmptyState
          icon={<Inbox className="h-7 w-7" />}
          title="Você ainda não enviou nenhuma proposta"
          description="Quando você responder a uma cotação recebida, ela aparece aqui."
        />
      )}

      {!loading && !error && propostas.length > 0 && filtered.length === 0 && (
        <EmptyState
          title="Nenhuma proposta com esse status"
          description="Tente outro filtro para ver suas propostas."
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((proposta) => (
            <Card key={proposta.id} className="border-neutral-200 dark:border-white/[0.06]">
              <CardBody className="flex items-center justify-between p-5 gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-200 truncate">
                      {proposta.cotacao?.titulo ?? "Cotação"}
                    </h3>
                    <Badge variant={STATUS_COLOR[proposta.status] ?? "default"}>
                      {PROPOSTA_STATUS_LABELS[proposta.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span>Enviada em {formatDate(proposta.created_at)}</span>
                    {proposta.cotacao?.data_limite && (
                      <span>Prazo: {formatDate(proposta.cotacao.data_limite)}</span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <p className="text-lg font-bold text-neutral-900 dark:text-white">
                      {proposta.valor_total != null
                        ? formatCurrency(proposta.valor_total)
                        : "—"}
                    </p>
                    <p className="text-xs text-neutral-500">Valor total</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => openDetalhe(proposta.id)}>
                    <Eye className="h-3.5 w-3.5" />
                    Detalhes
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={detalhe != null || detailLoading || detailError != null}
        onClose={() => {
          setDetalhe(null);
          setDetailError(null);
          setItemExpandido(null);
        }}
        className="max-w-2xl max-h-[90vh] flex flex-col"
      >
        {detailLoading && (
          <>
            <ModalHeader onClose={() => setDetailError(null)}>Proposta</ModalHeader>
            <ModalBody>
              <div className="flex items-center justify-center py-10 text-neutral-500 dark:text-neutral-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando proposta...
              </div>
            </ModalBody>
          </>
        )}

        {!detailLoading && detailError && (
          <>
            <ModalHeader onClose={() => setDetailError(null)}>Proposta</ModalHeader>
            <ModalBody>
              <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-950/30 px-4 py-3">
                <AlertCircle className="h-4.5 w-4.5 text-danger-500 shrink-0 mt-0.5" />
                <p className="text-sm text-danger-700 dark:text-danger-300">{detailError}</p>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setDetailError(null)}>
                Fechar
              </Button>
            </ModalFooter>
          </>
        )}

        {!detailLoading && !detailError && detalhe && (
          <>
            <ModalHeader onClose={() => setDetalhe(null)}>
              <span className="inline-flex items-center gap-2.5">
                {detalhe.cotacao?.titulo ?? "Proposta"}
                <Badge variant={STATUS_COLOR[detalhe.status] ?? "default"}>
                  {(() => {
                    const StatusIcon = STATUS_ICON[detalhe.status];
                    return StatusIcon ? <StatusIcon className="h-3 w-3" /> : null;
                  })()}
                  {PROPOSTA_STATUS_LABELS[detalhe.status]}
                </Badge>
              </span>
            </ModalHeader>
            <ModalBody className="space-y-5 flex-1 min-h-0 overflow-y-auto">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 -mt-2">
                Enviada em {formatDateTime(detalhe.created_at)}
              </p>

              <div className="rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/[0.06] bg-neutral-50 dark:bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                  <CalendarClock className="h-3.5 w-3.5" />
                  <p className="text-xs font-medium">Prazo de entrega</p>
                </div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-200 mt-1.5">
                  {detalhe.prazo_entrega ?? "—"}
                </p>
              </div>

              <div>
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-200 mb-1">
                  <Package className="h-4 w-4 text-neutral-400" />
                  Itens da proposta
                  <span className="font-normal text-neutral-400">({detalhe.itens.length})</span>
                </h4>
                {/* Lista minimalista: nome + preço unitário ofertado. Divisória
                    discreta entre as ofertas, sem cartão em volta. */}
                <div className="divide-y divide-neutral-200 dark:divide-white/[0.06]">
                  {detalhe.itens.map((item) => {
                    const aberto = itemExpandido === item.id;
                    return (
                      <div key={item.id}>
                        <PropostaItemRow
                          item={item}
                          expanded={aberto}
                          onClick={() =>
                            setItemExpandido((atual) => (atual === item.id ? null : item.id))
                          }
                        />
                        {aberto && (
                          <p className="px-1 pb-3 -mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {item.observacao?.trim() ? (
                              <span className="italic">{item.observacao}</span>
                            ) : (
                              "Sem observações neste item."
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="justify-between">
              {/* `cotacao_id` sempre vem na proposta; o embed `cotacao` é só
                  pro título. Linkar pelo id garante que o botão nunca some. */}
              <Link href={`/fornecedor/cotacoes/${detalhe.cotacao?.id ?? detalhe.cotacao_id}`}>
                <Button variant="ghost">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver cotação
                </Button>
              </Link>
              <Button variant="secondary" onClick={() => setDetalhe(null)}>
                Fechar
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
