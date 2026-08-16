"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { apiFetchPublic } from "@/lib/api/backend-client";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SuccessCheck } from "@/components/ui/success-check";
import { ObservationEditModal } from "@/components/cotacoes/ObservationEditModal";
import { ImagePreviewModal } from "@/components/produtos/ImagePreviewModal";
import { PropostaProgressBar } from "@/components/cotacoes/PropostaProgressBar";
import { PropostaItemRowCompact } from "@/components/cotacoes/PropostaItemRowCompact";
import { ConfirmarSenhaModal } from "@/components/proposta/ConfirmarSenhaModal";
import { centsToDecimal, formatCurrency } from "@/lib/utils";

interface CotacaoItem {
  id: string;
  nome_produto: string;
  unidade: string;
  observacao: string | null;
  imagem_url: string | null;
}

interface PropostaFormProps {
  /** Token do convite **desta conta** (resolvido no servidor). */
  token: string;
  cotacao: { id: string; titulo: string };
  itens: CotacaoItem[];
  /** Empresa do convite ou do cadastro — vai junto no envio, sem campo na tela. */
  nomeEmpresa?: string | null;
  /** Telefone da conta logada — idem, e identifica a senha pedida no fim. */
  telefone?: string | null;
  /** `false` = migration 023 pendente; o campo de observações some da tela em
   * vez de fingir que grava (ver 023_proposta_observacao_geral.sql). */
  observacaoGeralSuportada?: boolean;
}

interface ItemFormState {
  precoCents: number;
  observacao: string;
  /** false = fornecedor marcou explicitamente "Não tenho o produto". */
  disponivel: boolean;
}

/** Etapas do envio: aviso de itens em branco → revisão → senha → sucesso. */
type EtapaEnvio = "preenchendo" | "faltando" | "revisao" | "senha" | "enviado";

export function PropostaForm({
  token,
  cotacao,
  itens,
  nomeEmpresa,
  telefone,
  observacaoGeralSuportada = true,
}: PropostaFormProps) {
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [observacaoGeral, setObservacaoGeral] = useState("");
  const [itensForm, setItensForm] = useState<Record<string, ItemFormState>>(
    Object.fromEntries(
      itens.map((item) => [item.id, { precoCents: 0, observacao: "", disponivel: true }]),
    ),
  );
  const [etapa, setEtapa] = useState<EtapaEnvio>("preenchendo");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propostaId, setPropostaId] = useState<string | null>(null);
  const [activeObsItem, setActiveObsItem] = useState<{ id: string; nome: string } | null>(null);
  const [activeImageItem, setActiveImageItem] = useState<{
    url: string | null;
    nome: string;
  } | null>(null);

  const priceRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const enviarBtnRef = useRef<HTMLButtonElement>(null);

  function updateItem(id: string, field: "precoCents" | "observacao", value: string | number) {
    setItensForm((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  /**
   * Preço de um item — e **só** dele.
   *
   * A cascata automática (preencher um campo repetia o valor no seguinte)
   * saiu por decisão de produto: ela adivinhava um preço que ninguém digitou e
   * mandava esse número pro comprador como se fosse oferta. Repetir valor
   * agora é sempre um clique explícito no botão "Duplicar".
   */
  function setPreco(id: string, cents: number) {
    setItensForm((prev) => ({ ...prev, [id]: { ...prev[id], precoCents: cents } }));
  }

  function toggleDisponivel(id: string) {
    setItensForm((prev) => {
      const atual = prev[id];
      const disponivel = !atual.disponivel;
      return {
        ...prev,
        // Marcar "não tenho" zera o preço — evita levar pro backend um valor
        // digitado antes de marcar a indisponibilidade.
        [id]: { ...atual, disponivel, precoCents: disponivel ? atual.precoCents : 0 },
      };
    });
  }

  /** "Duplicar" só faz sentido quando há um preço anterior real pra copiar e
   * o atual ainda é diferente dele. */
  function podeDuplicarValorAnterior(index: number): boolean {
    if (index === 0) return false;
    const anterior = itensForm[itens[index - 1].id];
    const atual = itensForm[itens[index].id];
    if (!anterior || !atual) return false;
    return anterior.precoCents > 0 && atual.precoCents !== anterior.precoCents;
  }

  function duplicarValorAnterior(index: number) {
    if (!podeDuplicarValorAnterior(index)) return;
    setPreco(itens[index].id, itensForm[itens[index - 1].id].precoCents);
  }

  /** Enter (desktop/teclado virtual mobile) e Tab avançam pro próximo campo
   * de preço — Shift+Tab mantém o comportamento nativo de voltar. */
  function handlePrecoKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    const avancar = e.key === "Enter" || (e.key === "Tab" && !e.shiftKey);
    if (!avancar) return;
    e.preventDefault();
    // Pula itens marcados "Não tenho" (input desabilitado, foco não pega).
    const proximo = itens.slice(index + 1).find((item) => itensForm[item.id]?.disponivel !== false);
    if (proximo) {
      priceRefs.current[proximo.id]?.focus();
    } else {
      enviarBtnRef.current?.focus();
    }
  }

  function proximoEnterKeyHint(index: number): "next" | "done" {
    const temProximoDisponivel = itens
      .slice(index + 1)
      .some((item) => itensForm[item.id]?.disponivel !== false);
    return temProximoDisponivel ? "next" : "done";
  }

  const respondidos = useMemo(
    () =>
      itens.filter((item) => {
        const state = itensForm[item.id];
        return state.disponivel === false || state.precoCents > 0;
      }).length,
    [itens, itensForm],
  );

  /** Itens que entram na proposta: com preço ou marcados "não tenho". É a
   * mesma lista que a revisão mostra — nada aparece lá que não seja enviado. */
  const itensPreenchidos = useMemo(
    () =>
      itens.filter((item) => {
        const state = itensForm[item.id];
        return state.disponivel === false || state.precoCents > 0;
      }),
    [itens, itensForm],
  );

  function buildPayloadItens() {
    return itensPreenchidos.map((item) => {
      const state = itensForm[item.id];
      return {
        cotacao_item_id: item.id,
        preco_unitario: state.disponivel === false ? 0 : centsToDecimal(state.precoCents),
        observacao: state.observacao.trim() || undefined,
        disponivel: state.disponivel,
      };
    });
  }

  /** Passo 1 — clicou em Enviar: avisa sobre itens sem resposta, ou vai
   * direto para a revisão. */
  function handleEnviarClick() {
    setError(null);

    if (itensPreenchidos.length === 0) {
      setError('Informe o preço de pelo menos um item ou marque como "Não tenho".');
      return;
    }

    setEtapa(itensPreenchidos.length < itens.length ? "faltando" : "revisao");
  }

  /** Passo 4 — senha confirmada: grava a proposta. */
  async function handleEnviarProposta() {
    setSubmitting(true);
    setError(null);
    try {
      const proposta = await apiFetchPublic<{ id: string }>("/propostas", {
        method: "POST",
        body: JSON.stringify({
          token_acesso: token,
          prazo_entrega: prazoEntrega.trim() || undefined,
          observacao: observacaoGeral.trim() || undefined,
          whatsapp: telefone ?? undefined,
          nome_empresa: nomeEmpresa?.trim() || undefined,
          itens: buildPayloadItens(),
        }),
      });
      setPropostaId(proposta.id);
      setEtapa("enviado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar proposta.");
      // Volta pra revisão: o erro é do envio, não da senha — repetir a senha
      // não resolveria nada e só esconderia a mensagem.
      setEtapa("revisao");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Passo 5 — sucesso ─────────────────────────────────────────────────────
  if (etapa === "enviado") {
    const destino = propostaId
      ? `/fornecedor/propostas?aberta=${propostaId}`
      : "/fornecedor/propostas";

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-900 px-4 py-12">
        <Logo variant="full" scheme="dark" size="md" className="mb-6" />
        <div className="w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-2xl p-8 text-center shadow-2xl">
          <SuccessCheck className="mx-auto mb-6" />
          <h2 className="text-xl font-bold text-white mb-2">Proposta enviada com sucesso</h2>
          <p className="text-sm text-neutral-400 mb-6">
            O comprador vai analisar sua proposta e entrar em contato.
          </p>
          <Link
            href={destino}
            className="inline-flex w-full items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            Ver minhas propostas
          </Link>
        </div>
      </div>
    );
  }

  const faltando = itens.length - respondidos;

  return (
    <div className="min-h-screen bg-neutral-900">
      <div className="mx-auto w-full max-w-2xl px-4 pt-6">
        <div className="mb-4 flex justify-center">
          <Logo variant="full" scheme="dark" size="sm" priority />
        </div>
        <PropostaProgressBar respondidos={respondidos} total={itens.length} />
      </div>

      <div className="px-4 pb-12">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mx-auto mt-4 w-full max-w-2xl bg-neutral-900 border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl animate-scale-in"
        >
          <h1 className="text-xl font-bold text-white mb-1">{cotacao.titulo}</h1>
          <p className="text-sm text-neutral-400 mb-8">
            Informe o preço por unidade dos itens que você pode fornecer.
          </p>

          <div className="space-y-2 mb-8">
            {itens.map((item, index) => {
              const state = itensForm[item.id];

              return (
                <PropostaItemRowCompact
                  key={item.id}
                  id={item.id}
                  nomeProduto={item.nome_produto}
                  unidade={item.unidade}
                  temObservacaoCompra={!!item.observacao}
                  precoCents={state.precoCents}
                  disponivel={state.disponivel}
                  temObservacaoResposta={!!state.observacao}
                  podeDuplicar={state.disponivel && podeDuplicarValorAnterior(index)}
                  onOpenRow={() =>
                    setActiveImageItem({ url: item.imagem_url, nome: item.nome_produto })
                  }
                  onPriceChange={(cents) => setPreco(item.id, cents)}
                  onPriceKeyDown={(e) => handlePrecoKeyDown(e, index)}
                  enterKeyHint={proximoEnterKeyHint(index)}
                  onToggleDisponivel={() => toggleDisponivel(item.id)}
                  onOpenObservacao={() => setActiveObsItem({ id: item.id, nome: item.nome_produto })}
                  onDuplicar={() => duplicarValorAnterior(index)}
                  priceInputRef={(el) => {
                    priceRefs.current[item.id] = el;
                  }}
                />
              );
            })}
          </div>

          {/* Campos que valem pra proposta inteira — logo abaixo da listagem,
              onde o fornecedor chega depois de responder item a item. */}
          <div className="space-y-5 mb-8 border-t border-white/[0.06] pt-6">
            <div>
              <label htmlFor="prazo-entrega" className="block text-sm font-medium text-white mb-1">
                Prazo de entrega
              </label>
              <input
                id="prazo-entrega"
                type="text"
                value={prazoEntrega}
                onChange={(e) => setPrazoEntrega(e.target.value)}
                placeholder="Ex: 5 dias úteis"
                className="w-full rounded-md bg-neutral-900 border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all"
              />
            </div>

            {observacaoGeralSuportada && (
              <div>
                <label
                  htmlFor="observacoes-gerais"
                  className="block text-sm font-medium text-white mb-1"
                >
                  Observações gerais
                </label>
                <textarea
                  id="observacoes-gerais"
                  rows={3}
                  value={observacaoGeral}
                  onChange={(e) => setObservacaoGeral(e.target.value)}
                  placeholder="Condições de pagamento, pedido mínimo, frete..."
                  className="w-full rounded-md bg-neutral-900 border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all resize-y"
                />
                <p className="mt-1.5 text-xs text-neutral-500">
                  Vale para a proposta inteira. Para falar de um produto específico, use
                  &quot;Deixar Obs&quot; na linha dele.
                </p>
              </div>
            )}
          </div>

          {error && etapa === "preenchendo" && (
            <p className="text-sm text-danger-400 mb-4" role="alert">
              {error}
            </p>
          )}

          <button
            ref={enviarBtnRef}
            type="button"
            onClick={handleEnviarClick}
            className="inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            <Send className="h-4 w-4" />
            Enviar proposta
          </button>
        </form>
      </div>

      {/* Passo 2 — itens sem resposta */}
      <ConfirmDialog
        open={etapa === "faltando"}
        onClose={() => setEtapa("preenchendo")}
        onConfirm={() => setEtapa("revisao")}
        title="Itens sem resposta"
        description={`${faltando === 1 ? "Falta" : "Faltam"} ${faltando} ${
          faltando === 1 ? "item" : "itens"
        } sem resposta. Enviar mesmo assim?`}
        confirmLabel="Enviar mesmo assim"
        variant="warning"
      />

      {/* Passo 3 — revisão, só com o que foi preenchido */}
      <Modal
        open={etapa === "revisao"}
        onClose={() => setEtapa("preenchendo")}
        className="max-w-lg"
      >
        <ModalHeader onClose={() => setEtapa("preenchendo")}>Revisar proposta</ModalHeader>
        <ModalBody className="space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Estes são os {itensPreenchidos.length}{" "}
            {itensPreenchidos.length === 1 ? "item" : "itens"} que serão enviados. Confirma?
          </p>

          <div className="space-y-2">
            {itensPreenchidos.map((item) => {
              const state = itensForm[item.id];

              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-neutral-100 dark:border-white/[0.06] pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
                      {item.nome_produto}
                    </p>
                    {state.observacao && (
                      <p className="text-xs text-neutral-500 mt-0.5">{state.observacao}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      state.disponivel === false
                        ? "text-neutral-400 font-semibold text-xs"
                        : "text-success-600 dark:text-success-400"
                    }`}
                  >
                    {state.disponivel === false
                      ? "Não tenho"
                      : formatCurrency(centsToDecimal(state.precoCents))}
                  </span>
                </div>
              );
            })}
          </div>

          {(prazoEntrega || observacaoGeral) && (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1 pt-2 border-t border-neutral-100 dark:border-white/[0.06]">
              {prazoEntrega && <p>Prazo de entrega: {prazoEntrega}</p>}
              {observacaoGeral && <p>Observações: {observacaoGeral}</p>}
            </div>
          )}

          {error && (
            <p className="text-sm text-danger-500 dark:text-danger-400" role="alert">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setEtapa("preenchendo")}>
            Voltar e corrigir
          </Button>
          {/* Não tem estado de carregando: aqui só se avança pro passo da
              senha — quem grava a proposta é o modal seguinte. */}
          <Button onClick={() => setEtapa("senha")}>
            <Send className="h-4 w-4" />
            Sim, enviar proposta
          </Button>
        </ModalFooter>
      </Modal>

      {/* Passo 4 — confirmação por senha */}
      <ConfirmarSenhaModal
        open={etapa === "senha"}
        onClose={() => setEtapa("revisao")}
        onConfirmado={handleEnviarProposta}
        telefone={telefone}
        enviando={submitting}
      />

      <ObservationEditModal
        open={!!activeObsItem}
        onClose={() => setActiveObsItem(null)}
        onSave={(texto) => {
          if (!activeObsItem) return;
          updateItem(activeObsItem.id, "observacao", texto);
          setActiveObsItem(null);
        }}
        productName={activeObsItem?.nome ?? ""}
        initialText={activeObsItem ? itensForm[activeObsItem.id]?.observacao ?? "" : ""}
      />

      {activeImageItem && (
        <ImagePreviewModal
          open={!!activeImageItem}
          onClose={() => setActiveImageItem(null)}
          imageUrl={activeImageItem.url}
          productName={activeImageItem.nome}
        />
      )}
    </div>
  );
}
