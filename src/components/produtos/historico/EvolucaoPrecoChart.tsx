"use client";

import {
  PERIODO_LABELS,
  PERIODOS,
  type PeriodoHistorico,
  type PontoHistorico,
} from "@/lib/historico-produto";
import { Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface EvolucaoPrecoChartProps {
  pontos: PontoHistorico[];
  periodo: PeriodoHistorico;
  onPeriodoChange: (p: PeriodoHistorico) => void;
  valorIdeal: number | null;
  /** Data (chave do bucket) sob o cursor ou fixada. */
  onHoverData: (data: string | null) => void;
  onSelecionarData: (data: string) => void;
  loading?: boolean;
  temHistoricoPrecoLoja: boolean;
}

const COR_LOJA = "var(--color-primary-500)";
const COR_OFERTA = "var(--color-success-500)";
const COR_IDEAL = "var(--color-neutral-400)";

function rotuloEixoX(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
}

interface TooltipPayloadItem {
  payload: PontoHistorico;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload;
  return (
    <div className="rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
        {new Date(`${ponto.data}T00:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
      </p>
      <p className="text-neutral-600 dark:text-neutral-300">
        Preço loja:{" "}
        <strong>{ponto.preco_loja != null ? formatCurrency(ponto.preco_loja) : "—"}</strong>
      </p>
      <p className="text-neutral-600 dark:text-neutral-300">
        Melhor oferta:{" "}
        <strong>{ponto.melhor_oferta != null ? formatCurrency(ponto.melhor_oferta) : "—"}</strong>
      </p>
    </div>
  );
}

export function EvolucaoPrecoChart({
  pontos,
  periodo,
  onPeriodoChange,
  valorIdeal,
  onHoverData,
  onSelecionarData,
  loading = false,
  temHistoricoPrecoLoja,
}: EvolucaoPrecoChartProps) {
  const temOferta = useMemo(() => pontos.some((p) => p.melhor_oferta != null), [pontos]);
  const temLoja = useMemo(() => pontos.some((p) => p.preco_loja != null), [pontos]);

  const dados = useMemo(
    () => pontos.map((p) => ({ ...p, valor_ideal: valorIdeal })),
    [pontos, valorIdeal],
  );

  return (
    <div className="rounded-[var(--radius-lg)] border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-800 px-5 py-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Gráfico de Evolução de Preço
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Acompanhe as variações do preço de loja e das ofertas de fornecedores nos últimos{" "}
            {PERIODO_LABELS[periodo]}
          </p>
        </div>
        <div className="w-full sm:w-36 shrink-0">
          <Select
            value={periodo}
            onChange={(e) => onPeriodoChange(e.target.value as PeriodoHistorico)}
            aria-label="Período do gráfico"
            options={PERIODOS.map((p) => ({ value: p, label: PERIODO_LABELS[p] }))}
            className="py-1.5! text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary-400" />
          Carregando histórico...
        </div>
      ) : !temOferta && !temLoja ? (
        <div className="flex h-[240px] flex-col items-center justify-center text-center px-4">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Sem histórico neste período
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm">
            Não há ofertas nem mudanças de preço registradas nos últimos{" "}
            {PERIODO_LABELS[periodo]}. Tente um período maior.
          </p>
        </div>
      ) : (
        <>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dados}
                margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
                // `activeLabel` é o valor do dataKey do eixo X (a chave do
                // bucket). No Recharts 3 é o campo tipado do handler — mais
                // estável que cavar dentro de `activePayload`.
                onMouseMove={(state) => {
                  const chave = state?.activeLabel;
                  onHoverData(typeof chave === "string" ? chave : null);
                }}
                onMouseLeave={() => onHoverData(null)}
                onClick={(state) => {
                  const chave = state?.activeLabel;
                  if (typeof chave === "string") onSelecionarData(chave);
                }}
              >
                <defs>
                  <linearGradient id="fillLoja" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COR_LOJA} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={COR_LOJA} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillOferta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COR_OFERTA} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={COR_OFERTA} stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-neutral-200 dark:text-white/[0.06]" vertical={false} />
                <XAxis
                  dataKey="data"
                  tickFormatter={rotuloEixoX}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-neutral-400"
                  minTickGap={24}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-neutral-400"
                  width={82}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: COR_LOJA, strokeOpacity: 0.3 }} />

                {temLoja && (
                  <Area
                    type="monotone"
                    dataKey="preco_loja"
                    name="Preço loja"
                    stroke={COR_LOJA}
                    strokeWidth={2}
                    fill="url(#fillLoja)"
                    connectNulls
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}
                {temOferta && (
                  <Area
                    type="monotone"
                    dataKey="melhor_oferta"
                    name="Melhor preço ofertado"
                    stroke={COR_OFERTA}
                    strokeWidth={2}
                    fill="url(#fillOferta)"
                    connectNulls
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}
                {valorIdeal != null && (
                  // Referência secundária: tracejada, sem área, sem ponto —
                  // é uma meta, não uma medição.
                  <Line
                    type="monotone"
                    dataKey="valor_ideal"
                    name="Valor ideal"
                    stroke={COR_IDEAL}
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-neutral-500">
            {temLoja && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COR_LOJA }} />
                Preço loja
              </span>
            )}
            {temOferta && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COR_OFERTA }} />
                Melhor preço ofertado
              </span>
            )}
            {valorIdeal != null && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: COR_IDEAL }} />
                Valor ideal
              </span>
            )}
          </div>

          {!temHistoricoPrecoLoja && (
            <p className="mt-3 text-[11px] text-neutral-500 border-t border-neutral-100 dark:border-white/[0.06] pt-2.5">
              A série <strong>Preço loja</strong> começa a ser registrada a partir da próxima
              alteração de preço deste produto.
            </p>
          )}
        </>
      )}
    </div>
  );
}
