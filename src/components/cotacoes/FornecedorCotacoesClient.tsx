"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { ArrowRight, Building2, Inbox, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

interface CotacaoDisponivel {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  created_at: string;
  profiles: { nome: string | null; empresa: string | null } | null;
  cotacao_itens: { id: string }[] | null;
}

type FilterMode = "todas" | "novas" | "enviadas";

export function FornecedorCotacoesClient({
  cotacoes,
  proposedCotacaoIds,
  totalEnviadas,
}: {
  cotacoes: CotacaoDisponivel[];
  proposedCotacaoIds: string[];
  totalEnviadas: number;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("todas");

  const proposedSet = useMemo(() => new Set(proposedCotacaoIds), [proposedCotacaoIds]);

  const filtered = useMemo(() => {
    let result = cotacoes;

    // Text search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.titulo.toLowerCase().includes(term) ||
          (c.profiles?.empresa ?? "").toLowerCase().includes(term) ||
          (c.profiles?.nome ?? "").toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filterMode === "novas") {
      result = result.filter((c) => !proposedSet.has(c.id));
    } else if (filterMode === "enviadas") {
      result = result.filter((c) => proposedSet.has(c.id));
    }

    return result;
  }, [cotacoes, searchTerm, filterMode, proposedSet]);

  const novasCount = cotacoes.filter((c) => !proposedSet.has(c.id)).length;

  const filterTabs: { key: FilterMode; label: string; count: number }[] = [
    { key: "todas", label: "Todas", count: cotacoes.length },
    { key: "novas", label: "Novas", count: novasCount },
    { key: "enviadas", label: "Enviadas", count: totalEnviadas },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Oportunidades</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Encontre novas cotações e envie suas melhores propostas
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar por título ou empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-neutral-500 outline-none focus:border-primary-500 transition-colors"
          />
        </div>

        {/* Mode filter pills */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg border border-white/[0.06] p-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterMode(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterMode === tab.key
                  ? "bg-primary-500/15 text-primary-400"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  filterMode === tab.key
                    ? "bg-primary-500/20 text-primary-300"
                    : "bg-white/[0.05] text-neutral-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {!cotacoes || cotacoes.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-7 w-7" />}
          title="Nenhuma cotação disponível"
          description="Fique atento! Novas oportunidades podem surgir a qualquer momento."
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-neutral-500 text-sm">
          Nenhuma cotação encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((cotacao) => {
            const alreadyProposed = proposedSet.has(cotacao.id);

            return (
              <Link key={cotacao.id} href={`/fornecedor/cotacoes/${cotacao.id}`}>
                <Card
                  interactive
                  className="group overflow-hidden border-white/[0.06] hover:border-primary-500/50 transition-all duration-300"
                >
                  <CardBody className="flex items-center justify-between p-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-bold text-neutral-100 truncate group-hover:text-primary-400 transition-colors">
                          {cotacao.titulo}
                        </h3>
                        {alreadyProposed ? (
                          <Badge
                            variant="default"
                            className="bg-neutral-800 text-neutral-400 border border-white/[0.05] shrink-0"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-neutral-500 mr-1" />
                            Enviado
                          </Badge>
                        ) : (
                          <Badge
                            variant="success"
                            className="bg-success-500/15 text-success-400 border border-success-500/25 px-2.5 shrink-0"
                          >
                            <span className="relative flex h-2 w-2 mr-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
                            </span>
                            Novo
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-400">
                          <Building2 className="h-4 w-4 text-primary-400/70" />
                          {cotacao.profiles?.empresa || cotacao.profiles?.nome}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-white/10 hidden sm:block" />
                        <span className="flex items-center gap-1.5 font-medium text-neutral-400">
                          {cotacao.cotacao_itens?.length ?? 0}{" "}
                          {cotacao.cotacao_itens?.length === 1 ? "item" : "itens"}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-white/10 hidden sm:block" />
                        <span className="text-neutral-500 tracking-tight">
                          Publicada em {formatDate(cotacao.created_at)}
                        </span>
                      </div>

                      {cotacao.descricao && (
                        <p className="mt-3 text-xs text-neutral-400 line-clamp-1 italic bg-neutral-900 border border-white/[0.08] p-2.5 rounded-[var(--radius-md)]">
                          &ldquo;{cotacao.descricao}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="ml-4 flex items-center gap-2 text-neutral-500 group-hover:text-primary-400 transition-all">
                      <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">
                        Acessar
                      </span>
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
