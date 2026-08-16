"use client";

import { getHistoricoProduto } from "@/actions/product-history";
import {
  PERIODO_LABELS,
  type HistoricoProduto,
  type PeriodoHistorico,
} from "@/lib/historico-produto";
import { calcularValorIdeal, type MargemConfig } from "@/lib/margem";
import { History, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { EvolucaoPrecoChart } from "./EvolucaoPrecoChart";
import { MargemStatusBanner } from "./MargemStatusBanner";
import { OfertasFornecedoresCard } from "./OfertasFornecedoresCard";
import { SimuladorPrecoVenda } from "./SimuladorPrecoVenda";

interface ProdutoHistoricoSectionProps {
  productId: string;
  margemConfig: MargemConfig;
  historicoInicial: HistoricoProduto;
}

/**
 * Seção "Histórico" da página do produto.
 *
 * Dona de dois estados que ligam o gráfico à coluna de ofertas:
 * `dataHover` (passageiro, some ao sair do gráfico) e `dataFixada` (persiste
 * até o usuário limpar). A fixada vence a de hover — senão passar o mouse
 * depois de clicar desfaria a fixação sem o usuário pedir.
 */
export function ProdutoHistoricoSection({
  productId,
  margemConfig,
  historicoInicial,
}: ProdutoHistoricoSectionProps) {
  const [historico, setHistorico] = useState(historicoInicial);
  const [periodo, setPeriodo] = useState<PeriodoHistorico>(historicoInicial.periodo);
  const [carregando, startTransition] = useTransition();

  const [dataHover, setDataHover] = useState<string | null>(null);
  const [dataFixada, setDataFixada] = useState<string | null>(null);

  // Troca de período refetcha no servidor — não fatia o dataset já carregado,
  // senão períodos maiores nunca trariam dado novo.
  useEffect(() => {
    if (periodo === historico.periodo) return;
    startTransition(async () => {
      const novo = await getHistoricoProduto(productId, periodo);
      setHistorico(novo);
      setDataHover(null);
      setDataFixada(null);
    });
  }, [periodo, productId, historico.periodo]);

  const dataEmFoco = dataFixada ?? dataHover;

  const ofertasExibidas = useMemo(() => {
    if (!dataEmFoco) return historico.ofertasAtuais;
    return historico.pontos.find((p) => p.data === dataEmFoco)?.ofertas ?? [];
  }, [dataEmFoco, historico]);

  const valorIdeal = useMemo(
    () =>
      calcularValorIdeal(
        historico.precoLojaAtual,
        margemConfig.margem_percent,
        margemConfig.metodo,
      ),
    [historico.precoLojaAtual, margemConfig],
  );

  // O banner e o simulador falam do estado ATUAL do produto, não da data que o
  // usuário está inspecionando no gráfico — por isso usam sempre `ofertasAtuais`.
  const melhorOfertaAtual = useMemo(() => {
    const valores = historico.ofertasAtuais.map((o) => o.valor);
    return valores.length > 0 ? Math.min(...valores) : null;
  }, [historico.ofertasAtuais]);

  if (historico.error) {
    return (
      <section id="historico" className="mt-10">
        <SectionHeader />
        <p className="text-sm text-danger-500">
          Não foi possível carregar o histórico deste produto ({historico.error}).
        </p>
      </section>
    );
  }

  return (
    <section id="historico" className="mt-10">
      <SectionHeader />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <div className="lg:col-span-3 space-y-4">
          <MargemStatusBanner
            melhorOferta={melhorOfertaAtual}
            valorIdeal={valorIdeal}
            precoLojaAtual={historico.precoLojaAtual}
            margemConfig={margemConfig}
            periodoLabel={PERIODO_LABELS[periodo]}
          />
          <EvolucaoPrecoChart
            pontos={historico.pontos}
            periodo={periodo}
            onPeriodoChange={setPeriodo}
            valorIdeal={valorIdeal}
            onHoverData={setDataHover}
            onSelecionarData={(d) => setDataFixada((atual) => (atual === d ? null : d))}
            loading={carregando}
            temHistoricoPrecoLoja={historico.fontes.historicoPrecoLoja}
          />
        </div>

        <div className="lg:col-span-2">
          <OfertasFornecedoresCard
            ofertas={ofertasExibidas}
            valorIdeal={valorIdeal}
            margemConfig={margemConfig}
            dataEmFoco={dataEmFoco}
            fixada={dataFixada != null}
            onLimparFixada={() => {
              setDataFixada(null);
              setDataHover(null);
            }}
          />
        </div>
      </div>

      <div className="mt-4">
        <SimuladorPrecoVenda
          custoInicial={melhorOfertaAtual}
          precoLojaAtual={historico.precoLojaAtual}
          margemConfig={margemConfig}
        />
      </div>

      {carregando && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Atualizando período...
        </p>
      )}
    </section>
  );
}

function SectionHeader() {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary-500" />
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Histórico</h2>
      </div>
      <p className="text-sm text-neutral-500 mt-0.5">
        Veja a evolução do preço deste produto ao longo do tempo
      </p>
      <div className="mt-4 border-t border-neutral-200 dark:border-white/[0.06]" />
    </div>
  );
}
