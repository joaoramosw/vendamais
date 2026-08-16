"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Columns3, Percent, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  ColumnOrderEditor,
  loadColumnLabels,
  loadColumnOrder,
  saveColumnLabels,
  saveColumnOrder,
} from "@/components/ui/column-config-modal";
import {
  RESULTADO_COLUMNS,
  RESULTADO_COL_STORAGE_KEY,
  RESULTADO_DEFAULT_ORDER,
} from "@/lib/cotacao-resultado-columns";
import { updateMargemConfig } from "@/actions/margem";
import {
  calcularValorIdeal,
  DEFAULT_MARGEM_CONFIG,
  METODO_CALCULO_FORMULAS,
  METODO_CALCULO_LABELS,
  type MargemConfig,
  type MetodoCalculoMargem,
} from "@/lib/margem";
import { formatCurrency } from "@/lib/utils";

/** Preço de loja usado no preview — número redondo de propósito, pra
 * conferência mental rápida ("100 a 28,5% dá 77,82"). */
const PREVIEW_PRECO_LOJA = 100;

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{title}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
          </div>
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

/* ─── Margem e cálculo ──────────────────────────────────────────────────── */

function MargemSection({
  initialConfig,
  podeEditar,
}: {
  initialConfig: MargemConfig;
  podeEditar: boolean;
}) {
  const [config, setConfig] = useState<MargemConfig>(initialConfig);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState<MargemConfig>(initialConfig);

  const alterado = JSON.stringify(config) !== JSON.stringify(salvo);

  // Preview em tempo real: sai da MESMA função pura que a tabela usa, então o
  // que aparece aqui é literalmente o que a comparação vai calcular.
  const valorIdeal = calcularValorIdeal(PREVIEW_PRECO_LOJA, config.margem_percent, config.metodo);
  const folga = valorIdeal != null ? (valorIdeal * config.tolerancia_percent) / 100 : null;

  async function handleSalvar() {
    setSalvando(true);
    try {
      const result = await updateMargemConfig(config);
      if (result.success) {
        setSalvo(result.config);
        setConfig(result.config);
        toast.success("Configuração de margem salva.");
      } else {
        toast.error(result.error ?? "Erro ao salvar a configuração.");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SectionCard
      icon={<Percent className="h-4 w-4 text-primary-400" />}
      title="Margem e cálculo de valor"
      description="Define o valor ideal de compra usado como referência na comparação de cotações."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Margem padrão (%)"
          type="number"
          step="0.1"
          min="0"
          max="999"
          disabled={!podeEditar}
          value={String(config.margem_percent)}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, margem_percent: Number(e.target.value) }))
          }
          helper="Aplicada sobre o preço de loja para achar o valor ideal de compra."
        />
        <Input
          label='Tolerância do estado "igual" (%)'
          type="number"
          step="0.1"
          min="0"
          max="100"
          disabled={!podeEditar}
          value={String(config.tolerancia_percent)}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, tolerancia_percent: Number(e.target.value) }))
          }
          helper="Faixa em torno do ideal tratada como “no valor”, em vez de acima/abaixo."
        />
      </div>

      <Select
        label="Método de cálculo"
        disabled={!podeEditar}
        value={config.metodo}
        onChange={(e) =>
          setConfig((prev) => ({ ...prev, metodo: e.target.value as MetodoCalculoMargem }))
        }
        options={(["markup", "desconto"] as const).map((m) => ({
          value: m,
          label: `${METODO_CALCULO_LABELS[m]} — ${METODO_CALCULO_FORMULAS[m]}`,
        }))}
        helper="Markup é o método padrão do sistema: a margem incide sobre o custo de compra, não sobre o preço de venda."
      />

      {/* ─── Preview ─── */}
      <div className="rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/[0.08] bg-neutral-50 dark:bg-white/[0.02] px-4 py-3 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          Prévia do cálculo
        </p>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          Com preço de loja{" "}
          <span className="font-semibold tabular-nums">{formatCurrency(PREVIEW_PRECO_LOJA)}</span> →
          valor ideal{" "}
          <span className="font-semibold tabular-nums text-primary-600 dark:text-primary-400">
            {valorIdeal != null ? formatCurrency(valorIdeal) : "não calculável"}
          </span>
        </p>
        {valorIdeal != null && folga != null && (
          <p className="text-xs text-neutral-500">
            {folga > 0 ? (
              <span className="tabular-nums">
                Tratado como &quot;no valor&quot; entre {formatCurrency(valorIdeal - folga)} e{" "}
                {formatCurrency(valorIdeal + folga)}
              </span>
            ) : (
              "Tolerância zerada: só o valor exato conta como “no valor”"
            )}{" "}
            · acima disso o indicador fica vermelho (caro), abaixo fica verde (barato).
          </p>
        )}
        {valorIdeal == null && (
          <p className="text-xs text-danger-500">
            Com esses valores o método escolhido não produz um custo válido — reveja a margem.
          </p>
        )}
      </div>

      {podeEditar ? (
        <div className="flex items-center gap-2">
          <Button onClick={handleSalvar} loading={salvando} disabled={salvando || !alterado}>
            Salvar margem
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={salvando}
            onClick={() => setConfig(DEFAULT_MARGEM_CONFIG)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão ({DEFAULT_MARGEM_CONFIG.margem_percent}%)
          </Button>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">
          Só um administrador pode alterar a margem. Os valores acima são os que a comparação de
          cotações está usando.
        </p>
      )}
    </SectionCard>
  );
}

/* ─── Colunas da comparação ─────────────────────────────────────────────── */

function ColunasSection() {
  // localStorage só existe no cliente — estado começa no padrão e é
  // hidratado no efeito, evitando divergência de SSR.
  const [order, setOrder] = useState<string[]>(RESULTADO_DEFAULT_ORDER);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setOrder(loadColumnOrder(RESULTADO_COL_STORAGE_KEY, RESULTADO_DEFAULT_ORDER));
    setLabels(loadColumnLabels(RESULTADO_COL_STORAGE_KEY));
    setPronto(true);
  }, []);

  // Grava a cada mudança: não há botão "Salvar" aqui de propósito — é
  // preferência local de exibição, e o modal antigo já se comportava como
  // aplicação imediata depois de confirmar.
  const handleOrder = useCallback((next: string[]) => {
    setOrder(next);
    saveColumnOrder(RESULTADO_COL_STORAGE_KEY, next);
  }, []);

  const handleLabels = useCallback((next: Record<string, string>) => {
    setLabels(next);
    saveColumnLabels(RESULTADO_COL_STORAGE_KEY, next);
  }, []);

  function restaurar() {
    handleOrder(RESULTADO_DEFAULT_ORDER);
    handleLabels({});
    toast.success("Colunas restauradas para o padrão.");
  }

  return (
    <SectionCard
      icon={<Columns3 className="h-4 w-4 text-primary-400" />}
      title="Colunas da comparação de cotações"
      description="Arraste para reordenar; use o lápis para renomear. Colunas com cadeado são fixas. Vale só para este navegador."
    >
      {pronto && (
        <ColumnOrderEditor
          columns={RESULTADO_COLUMNS}
          order={order}
          labels={labels}
          onOrderChange={handleOrder}
          onLabelsChange={handleLabels}
        />
      )}

      <Button variant="ghost" size="sm" onClick={restaurar}>
        <RotateCcw className="h-3.5 w-3.5" />
        Restaurar padrão
      </Button>
    </SectionCard>
  );
}

export function AjustesClient({
  initialConfig,
  podeEditarMargem,
}: {
  initialConfig: MargemConfig;
  podeEditarMargem: boolean;
}) {
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <MargemSection initialConfig={initialConfig} podeEditar={podeEditarMargem} />
      <ColunasSection />
    </div>
  );
}
