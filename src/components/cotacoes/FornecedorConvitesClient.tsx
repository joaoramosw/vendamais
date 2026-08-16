"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { COTACAO_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { listarMeusConvites, type MeuConvite } from "@/lib/api/fornecedor-api";
import { propostaPath } from "@/lib/routes";
import { formatPhone } from "@/lib/whatsapp";
import { ExternalLink, Inbox, Loader2, Search } from "lucide-react";

const CONVITE_STATUS_LABELS: Record<MeuConvite["status_convite"], string> = {
  pendente: "Novo",
  visualizado: "Visualizado",
  respondido: "Você respondeu",
};

type StatusFilter = "" | "aberta" | "fechada" | "respondida";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "aberta", label: "Abertas" },
  { value: "fechada", label: "Fechadas" },
  { value: "respondida", label: "Respondidas" },
];

export function FornecedorConvitesClient() {
  const [convites, setConvites] = useState<MeuConvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setConvites(await listarMeusConvites());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar cotações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Backend já devolve ordenado (abertas primeiro, depois mais recentes) —
  // filtros aqui só reduzem a lista, sem reordenar.
  const filtered = useMemo(() => {
    let result = convites;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((c) => (c.cotacao?.titulo ?? "").toLowerCase().includes(term));
    }
    if (statusFilter === "aberta") {
      result = result.filter((c) => c.cotacao?.status === "aberta");
    } else if (statusFilter === "fechada") {
      // "Fechada" = o empresário encerrou a cotação — não tem relação com
      // ter respondido ou não.
      result = result.filter((c) => c.cotacao?.status === "fechada");
    } else if (statusFilter === "respondida") {
      // "Respondida" = você já enviou proposta — independe da cotação
      // ainda estar aberta ou já ter sido encerrada.
      result = result.filter((c) => c.status_convite === "respondido");
    }
    return result;
  }, [convites, searchTerm, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      "": convites.length,
      aberta: 0,
      fechada: 0,
      respondida: 0,
    };
    for (const c of convites) {
      if (c.cotacao?.status === "aberta") counts.aberta++;
      if (c.cotacao?.status === "fechada") counts.fechada++;
      if (c.status_convite === "respondido") counts.respondida++;
    }
    return counts;
  }, [convites]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Cotações Ativas</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Cotações que empresários te convidaram a responder
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-neutral-500">
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

      {!loading && !error && convites.length === 0 && (
        <EmptyState
          icon={<Inbox className="h-7 w-7" />}
          title="Nenhuma cotação recebida ainda"
          description="Quando um empresário te convidar pra uma cotação usando o telefone da sua conta, ela aparece aqui."
        />
      )}

      {!loading && !error && convites.length > 0 && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
                  {statusCounts[opt.value] > 0 && (
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

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-sm">
              Nenhuma cotação encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filtered.map((convite) => {
                const isAberta = convite.cotacao?.status === "aberta";
                const podeResponder = isAberta && convite.status_convite !== "respondido";

                return (
                  <Card key={convite.id} className="border-neutral-200 dark:border-white/[0.06]">
                    <CardBody className="flex items-center justify-between p-5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          {isAberta && (
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success-500" />
                            </span>
                          )}
                          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-200 truncate">
                            {convite.cotacao?.titulo ?? "Cotação"}
                          </h3>
                          {convite.cotacao && (
                            <Badge variant="default" dot>
                              {COTACAO_STATUS_LABELS[convite.cotacao.status]}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-neutral-500">
                          {CONVITE_STATUS_LABELS[convite.status_convite]}
                          {(convite.whatsapp || convite.email_contato) &&
                            ` · ${convite.whatsapp ? formatPhone(convite.whatsapp) : convite.email_contato}`}
                          {convite.cotacao?.data_limite &&
                            ` · Prazo: ${formatDate(convite.cotacao.data_limite)}`}
                        </span>
                      </div>

                      {convite.status_convite === "respondido" && convite.proposta_id ? (
                        <Link href={`/fornecedor/propostas?aberta=${convite.proposta_id}`}>
                          <Button size="sm" variant="secondary">
                            Ver proposta
                          </Button>
                        </Link>
                      ) : podeResponder ? (
                        <Link href={propostaPath(convite.token_acesso)} target="_blank">
                          <span className="relative inline-flex">
                            {/* Halo pulsante — mesmo espírito "dopaminérgico" do badge da sidebar,
                                chamando atenção pra cotação aberta esperando resposta. */}
                            <span className="absolute inset-0 rounded-lg bg-primary-500/50 animate-ping" />
                            <Button
                              size="sm"
                              className="relative transition-transform duration-150 hover:scale-105 active:scale-95"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Responder
                            </Button>
                          </span>
                        </Link>
                      ) : (
                        <span className="text-xs text-neutral-600 shrink-0 ml-4">
                          Cotação encerrada
                        </span>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
