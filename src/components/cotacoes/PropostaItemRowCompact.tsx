"use client";

import { memo } from "react";
import { Copy, MessageSquarePlus, Package, ToggleLeft, ToggleRight } from "lucide-react";
import { PriceInput } from "@/components/ui/price-input";
import { cn } from "@/lib/utils";

interface PropostaItemRowCompactProps {
  id: string;
  nomeProduto: string;
  unidade: string;
  temObservacaoCompra: boolean;
  precoCents: number;
  disponivel: boolean;
  temObservacaoResposta: boolean;
  /** Há um preço anterior diferente para copiar (ver PropostaForm). O botão
   * aparece de qualquer jeito — isto só decide se ele fica habilitado. */
  podeDuplicar: boolean;
  onOpenRow: () => void;
  onPriceChange: (cents: number) => void;
  onPriceKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onToggleDisponivel: () => void;
  onOpenObservacao: () => void;
  onDuplicar: () => void;
  priceInputRef: (el: HTMLInputElement | null) => void;
  /** Rótulo do botão "seguir/ok" do teclado virtual mobile — "next" avança
   * pro próximo preço, "done" fecha o teclado no último item disponível. */
  enterKeyHint?: "next" | "done";
}

/**
 * Linha de item da proposta.
 *
 * Ordem dos controles (decisão de produto, não acidente do layout):
 * **Duplicar → preço → Deixar Obs → Não tenho**. "Duplicar" ficou onde sempre
 * esteve, à esquerda do preço; "Deixar Obs" mudou de lugar para colar em "Não
 * tenho", que é a decisão vizinha ("não tenho" quase sempre pede uma
 * justificativa). Os botões são descritivos — ícone **e** texto: só o ícone
 * deixava o fornecedor sem saber que dava para escrever uma ressalva.
 *
 * **Duplicar está sempre presente**, desabilitado quando não há preço anterior
 * para repetir. Antes ele só era renderizado no momento exato em que dava para
 * duplicar, então aparecia e sumia entre uma linha e outra — o fornecedor não
 * chegava a aprender que o recurso existe. Ocupando lugar fixo, a linha também
 * para de "pular" quando o botão entra e sai.
 *
 * Abaixo de `sm` os controles quebram para a própria linha (`flex-wrap` +
 * `w-full`) e "Duplicar" fica **só com o ícone** (o rótulo volta a partir de
 * `sm`) — é o que mantém preço, Duplicar, Deixar Obs e Não tenho na mesma
 * faixa numa tela de 360px, sem scroll horizontal. O nome continua acessível
 * pelo `aria-label`/`title`.
 *
 * Clique na linha (fora dos controles) abre a única instância do modal de
 * foto, reaproveitada entre todas as linhas (ver PropostaForm#activeImageItem).
 */
function PropostaItemRowCompactBase({
  nomeProduto,
  unidade,
  temObservacaoCompra,
  precoCents,
  disponivel,
  temObservacaoResposta,
  podeDuplicar,
  onOpenRow,
  onPriceChange,
  onPriceKeyDown,
  onToggleDisponivel,
  onOpenObservacao,
  onDuplicar,
  priceInputRef,
  enterKeyHint,
}: PropostaItemRowCompactProps) {
  const naoTenho = !disponivel;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenRow}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenRow();
        }
      }}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border border-white/[0.06] rounded-lg px-3 py-2.5 transition-opacity cursor-pointer hover:border-white/[0.12]",
        naoTenho && "opacity-60",
      )}
    >
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-white/[0.04] border border-white/[0.08]">
        <Package className="h-4 w-4 text-neutral-500" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{nomeProduto}</p>
        <p className="text-xs text-neutral-500 truncate">
          {unidade}
          {temObservacaoCompra ? " · nota do comprador" : ""}
        </p>
      </div>

      <div
        // `flex-wrap`: com o "Duplicar" agora fixo, os quatro controles não
        // cabem lado a lado num aparelho de 360px — melhor quebrarem para uma
        // segunda linha do que estourarem a largura do card.
        className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:flex-nowrap"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <BotaoAcao
          onClick={onDuplicar}
          icone={<Copy className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
          rotulo="Duplicar"
          rotuloSoDesktop
          disabled={!podeDuplicar}
          title={
            podeDuplicar
              ? "Repetir o valor do item anterior"
              : "Preencha o preço do item acima para repetir aqui"
          }
        />

        <div className="w-28 sm:w-32 shrink-0">
          <PriceInput
            ref={priceInputRef}
            cents={precoCents}
            onCentsChange={onPriceChange}
            onKeyDown={onPriceKeyDown}
            disabled={naoTenho}
            placeholder="R$ 0,00"
            inputMode="decimal"
            enterKeyHint={enterKeyHint}
            aria-label={`Preço por unidade — ${nomeProduto}`}
            className="py-1.5! px-2.5! text-sm"
          />
        </div>

        <BotaoAcao
          onClick={onOpenObservacao}
          icone={<MessageSquarePlus className="h-3.5 w-3.5" />}
          rotulo="Deixar Obs"
          title={temObservacaoResposta ? "Editar observação" : "Deixar observação"}
          ativo={temObservacaoResposta}
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDisponivel();
          }}
          aria-pressed={naoTenho}
          title="Não tenho este item"
          className={cn(
            "flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-md transition-colors cursor-pointer shrink-0",
            naoTenho
              ? "bg-danger-500/10 text-danger-400"
              : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.06]",
          )}
        >
          {naoTenho ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          Não tenho
        </button>
      </div>
    </div>
  );
}

/** Botão descritivo (ícone + texto, nessa ordem) dos controles da linha. */
function BotaoAcao({
  onClick,
  icone,
  rotulo,
  title,
  ativo,
  disabled,
  rotuloSoDesktop,
}: {
  onClick: () => void;
  icone: React.ReactNode;
  rotulo: string;
  title: string;
  ativo?: boolean;
  disabled?: boolean;
  /** Abaixo de `sm` mostra só o ícone (o rótulo continua no `aria-label`). */
  rotuloSoDesktop?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={rotulo}
      className={cn(
        // min-h/min-w de 36px no mobile: alvo de toque confortável mesmo quando
        // o botão fica só com o ícone.
        "flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-md transition-colors shrink-0",
        rotuloSoDesktop && "min-h-9 min-w-9 sm:min-h-0 sm:min-w-0",
        disabled
          ? "bg-white/[0.02] text-neutral-600 cursor-not-allowed"
          : cn(
              "cursor-pointer",
              ativo
                ? "bg-primary-500/10 text-primary-400 hover:bg-primary-500/15"
                : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-300",
            ),
      )}
    >
      {icone}
      <span className={cn(rotuloSoDesktop && "hidden sm:inline")}>{rotulo}</span>
    </button>
  );
}

export const PropostaItemRowCompact = memo(PropostaItemRowCompactBase);
