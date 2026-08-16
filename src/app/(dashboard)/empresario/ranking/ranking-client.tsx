"use client";

import { getRankingGeral, type SupplierRankingEntry } from "@/actions/ranking-actions";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ArrowLeft,
    Award,
    Calendar,
    Medal,
    Search,
    Star,
    Target,
    Trophy,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

const MEDAL_COLORS = [
  "bg-warning-500/20 text-warning-400 border-warning-500/30", // 🥇
  "bg-neutral-400/20 text-neutral-300 border-neutral-400/30",    // 🥈
  "bg-orange-600/20 text-orange-400 border-orange-600/30", // 🥉
];

const MEDAL_ICONS = ["🥇", "🥈", "🥉"];

const DATE_FILTERS = [
  { label: "Todos", value: "" },
  { label: "30 dias", value: "30" },
  { label: "60 dias", value: "60" },
  { label: "90 dias", value: "90" },
];

export function RankingClient({
  initialRanking,
}: {
  initialRanking: SupplierRankingEntry[];
}) {
  const [ranking, setRanking] = useState(initialRanking);
  const [dateFilter, setDateFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDateFilter(days: string) {
    setDateFilter(days);
    startTransition(async () => {
      const dateFrom = days
        ? new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      const result = await getRankingGeral(dateFrom);
      setRanking(result);
    });
  }

  const filtered = searchTerm.trim()
    ? ranking.filter(
        (r) =>
          r.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.empresa && r.empresa.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : ranking;

  // Stats
  const totalFornecedores = ranking.length;
  const totalScore = ranking.reduce((a, b) => a + b.totalScore, 0);
  const totalWins = ranking.reduce((a, b) => a + b.wins, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/empresario/cotacoes"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
            <Trophy className="h-7 w-7 text-warning-400" />
            Ranking de Fornecedores
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Pontuação acumulada baseada no desempenho em todas as cotações.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary-500/15 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-neutral-900 dark:text-white">{totalFornecedores}</p>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                Fornecedores
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-warning-500/15 flex items-center justify-center">
              <Star className="h-5 w-5 text-warning-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-neutral-900 dark:text-white">{totalScore}</p>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                Pontos Total
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-success-500/15 flex items-center justify-center">
              <Award className="h-5 w-5 text-success-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-neutral-900 dark:text-white">{totalWins}</p>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                Vitórias (1º lugar)
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="border-b border-neutral-200 dark:border-white/[0.06] bg-neutral-50 dark:bg-white/[0.02]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Medal className="h-4 w-4 text-neutral-500" />
              Classificação Geral
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date filter */}
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-white/[0.03] rounded-lg border border-neutral-200 dark:border-white/[0.06] p-0.5">
                <Calendar className="h-3.5 w-3.5 text-neutral-500 ml-2" />
                {DATE_FILTERS.map((df) => (
                  <button
                    key={df.value}
                    onClick={() => handleDateFilter(df.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      dateFilter === df.value
                        ? "bg-primary-500/15 text-primary-400"
                        : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    {df.label}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Buscar fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 pr-3 bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] rounded-lg text-xs text-neutral-900 dark:text-white placeholder-neutral-500 outline-none focus:border-primary-500 transition-colors w-44"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Ranking Table */}
        <div className="overflow-x-auto">
          {isPending && (
            <div className="h-1 bg-primary-500/20 overflow-hidden">
              <div className="h-full bg-primary-500 animate-pulse w-1/2" />
            </div>
          )}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/[0.08]">
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase w-[60px]">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase">
                  Fornecedor
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase w-[100px]">
                  <span className="flex items-center justify-center gap-1">
                    <Star className="h-3 w-3" /> Pontos
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase w-[100px]">
                  <span className="flex items-center justify-center gap-1">
                    <Target className="h-3 w-3" /> Média Pos.
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase w-[80px]">
                  <span className="flex items-center justify-center gap-1">
                    <Trophy className="h-3 w-3" /> 1º Lugar
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase w-[80px]">
                  Itens
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase w-[120px]">
                  Participação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                    {searchTerm ? "Nenhum fornecedor encontrado." : "Nenhuma cotação com propostas no período."}
                  </td>
                </tr>
              )}
              {filtered.map((entry, index) => {
                const isTop3 = index < 3;
                return (
                  <tr
                    key={entry.fornecedorId}
                    className={`transition-colors ${
                      isTop3 ? "bg-neutral-50 dark:bg-white/[0.02]" : "hover:bg-neutral-50 dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Position */}
                    <td className="px-4 py-4 text-center">
                      {isTop3 ? (
                        <span
                          className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-black border ${MEDAL_COLORS[index]}`}
                        >
                          {MEDAL_ICONS[index]}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-neutral-500">{index + 1}º</span>
                      )}
                    </td>
                    {/* Supplier */}
                    <td className="px-4 py-4">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-200">
                        {entry.empresa || entry.nome}
                      </p>
                      {entry.empresa && (
                        <p className="text-[10px] text-neutral-500">{entry.nome}</p>
                      )}
                    </td>
                    {/* Score */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-warning-500/10 rounded-lg border border-warning-500/20">
                        <Star className="h-3.5 w-3.5 text-warning-400" />
                        <span className="text-sm font-black text-warning-400">
                          {entry.totalScore}
                        </span>
                      </span>
                    </td>
                    {/* Avg Position */}
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`text-sm font-bold ${
                          entry.avgPosition <= 1.5
                            ? "text-success-400"
                            : entry.avgPosition <= 2.5
                            ? "text-info-400"
                            : "text-neutral-400"
                        }`}
                      >
                        {entry.avgPosition.toFixed(1)}º
                      </span>
                    </td>
                    {/* Wins */}
                    <td className="px-4 py-4 text-center">
                      {entry.wins > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-success-400">
                          <Trophy className="h-3.5 w-3.5" />
                          {entry.wins}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    {/* Total Items */}
                    <td className="px-4 py-4 text-center text-sm font-medium text-neutral-400">
                      {entry.totalItems}
                    </td>
                    {/* Participation */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xs font-medium text-neutral-400">
                          {entry.cotacoesParticipadas}/{entry.totalCotacoes}
                        </span>
                        <div className="w-16 h-1.5 bg-neutral-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{
                              width: `${
                                entry.totalCotacoes > 0
                                  ? (entry.cotacoesParticipadas / entry.totalCotacoes) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Scoring explanation */}
      <div className="flex items-start gap-3 p-4 bg-neutral-50 dark:bg-white/[0.02] rounded-xl border border-neutral-200 dark:border-white/[0.06]">
        <Star className="h-4 w-4 text-warning-400 mt-0.5 shrink-0" />
        <div className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
          <p className="font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Como funciona a pontuação:</p>
          <p>
            Para cada item cotado: <span className="text-success-400 font-bold">1º lugar = 5 pts</span>,{" "}
            <span className="text-info-400 font-bold">2º lugar = 3 pts</span>,{" "}
            <span className="text-warning-400 font-bold">3º lugar = 1 pt</span>.
            A pontuação é acumulada em todas as cotações.
          </p>
        </div>
      </div>
    </div>
  );
}
