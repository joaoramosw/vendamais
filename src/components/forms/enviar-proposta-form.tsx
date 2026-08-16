"use client";

import { enviarProposta } from "@/actions/propostas";
import { ObservationEditModal } from "@/components/cotacoes/ObservationEditModal";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { type UnitType } from "@/lib/constants";
import type { CotacaoItem } from "@/lib/types/database";
import {
  centsToDecimal,
  decimalToCents,
  formatCents,
  formatCurrency,
  handleCentsInput,
} from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Copy, Info, MessageSquarePlus, Package, Send, ToggleLeft, ToggleRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const PropostaItemSchema = z.object({
  cotacao_item_id: z.string().min(1),
  preco_unitario: z.number().finite().min(0),
  observacao: z.string().optional().default(""),
  nao_tenho: z.boolean().optional().default(false),
});

const EnviarPropostaSchema = z
  .object({
    observacao: z.string().optional().default(""),
    itens: z.array(PropostaItemSchema).min(1),
  })
  .superRefine((data, ctx) => {
    data.itens.forEach((item, index) => {
      if (item.nao_tenho) return;
      if (!(item.preco_unitario > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["itens", index, "preco_unitario"],
          message: 'Informe um preço válido ou marque "Não tenho o produto".',
        });
      }
    });
  });

type EnviarPropostaValues = z.input<typeof EnviarPropostaSchema>;

interface EnviarPropostaFormProps {
  cotacaoId: string;
  // include optional related products for image
  cotacaoItens: (CotacaoItem & { products?: { image_url?: string } })[];
  previousPrices?: Record<string, number>;
}

export function EnviarPropostaForm({
  cotacaoId,
  cotacaoItens,
  previousPrices = {},
}: EnviarPropostaFormProps) {
  const [success, setSuccess] = useState(false);
  const [activeObsItem, setActiveObsItem] = useState<{
    index: number;
    id: string;
    name: string;
  } | null>(null);

  const defaultValues = useMemo<EnviarPropostaValues>(
    () => ({
      observacao: "",
      itens: cotacaoItens.map((item) => ({
        cotacao_item_id: item.id,
        preco_unitario: previousPrices[item.id] ?? 0,
        observacao: "",
        nao_tenho: false,
      })),
    }),
    [cotacaoItens, previousPrices]
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EnviarPropostaValues>({
    resolver: zodResolver(EnviarPropostaSchema),
    defaultValues,
    mode: "onChange",
  });

  // Ensure non-input fields are registered (observacao/nao_tenho/cotacao_item_id).
  useEffect(() => {
    cotacaoItens.forEach((_, index) => {
      register(`itens.${index}.cotacao_item_id`);
      register(`itens.${index}.observacao`);
      register(`itens.${index}.nao_tenho`);
    });
  }, [cotacaoItens.length, register]);

  const itensValues = watch("itens") ?? [];
  const allFilled = itensValues.every(
    (item) => Boolean(item.nao_tenho) || (item.preco_unitario ?? 0) > 0
  );

  function toggleNaoTenho(index: number) {
    const current = Boolean(getValues(`itens.${index}.nao_tenho`));
    const next = !current;

    setValue(`itens.${index}.nao_tenho`, next, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (next) {
      setValue(`itens.${index}.preco_unitario`, 0, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }

  function repeatPreviousPrice(index: number) {
    if (index === 0) return;
    const prevPrice = Number(getValues(`itens.${index - 1}.preco_unitario`) ?? 0);
    setValue(`itens.${index}.preco_unitario`, prevPrice, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  const onSubmit = async (values: EnviarPropostaValues) => {
    const itensPayload = values.itens.map((item, index) => {
      const naoTenho = Boolean(item.nao_tenho);
      const quantidadeSolicitada = cotacaoItens[index]?.quantidade ?? 0;

      return {
        cotacao_item_id: item.cotacao_item_id,
        preco_unitario: naoTenho ? 0 : item.preco_unitario,
        quantidade_disponivel: naoTenho ? 0 : quantidadeSolicitada,
        observacao: item.observacao ?? "",
        nao_tenho: naoTenho,
      };
    });

    const formData = new FormData();
    formData.set("cotacao_id", cotacaoId);
    formData.set("observacao", values.observacao ?? "");
    formData.set("itens", JSON.stringify(itensPayload));

    const result = await enviarProposta(formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Proposta enviada com sucesso!");
    setSuccess(true);
  };

  const onInvalid = () => {
    toast.error("Revise os campos destacados para enviar a proposta.");
  };

  if (success) {
    return (
      <Card className="border-success-100 dark:border-success-900/30 bg-success-50/20 dark:bg-success-900/10 text-center py-10">
        <CardBody className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 bg-success-100 dark:bg-success-900/40 text-success-600 dark:text-success-400 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-success-900 dark:text-success-100">
              Proposta Enviada!
            </h3>
            <p className="text-sm text-success-700 dark:text-success-300 max-w-sm">
              Sua proposta foi entregue com sucesso aos cuidados do empresário.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const activeObsText =
    activeObsItem ? (getValues(`itens.${activeObsItem.index}.observacao`) as string) : "";

  return (
    <Card className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/[0.06] shadow-xl overflow-hidden">
      <CardHeader className="p-6 bg-neutral-50 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-white/[0.05]">
        <CardTitle className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <Send className="h-5 w-5 text-primary-500" />
          Enviar Proposta
        </CardTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Informe o preço de cada item. Se não tiver o produto, marque a opção.
        </p>
      </CardHeader>

      <CardBody className="p-0">
        <form
          id="proposta-form"
          onSubmit={handleSubmit(onSubmit, onInvalid)}
        >
          <div className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
            {cotacaoItens.map((cotacaoItem, index) => {
              const unitType = (cotacaoItem.tipo_unidade || "UN") as UnitType;
              const currentValues = itensValues[index];
              const currentPrice = currentValues?.preco_unitario ?? 0;
              const naoTenho = Boolean(currentValues?.nao_tenho);
              const itemObs = currentValues?.observacao ?? "";
              const previousPrice = previousPrices[cotacaoItem.id];
              const imageUrl = cotacaoItem.products?.image_url;
              const priceError = errors.itens?.[index]?.preco_unitario?.message;

              const unitBadgeStyle: Record<string, string> = {
                UN: "bg-info-50 dark:bg-info-500/10 text-info-600 dark:text-info-400 border-info-100 dark:border-info-500/20",
                CX: "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-500/20",
                DZ: "bg-warning-50 dark:bg-warning-500/10 text-warning-600 dark:text-warning-400 border-warning-100 dark:border-warning-500/20",
                FD: "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-500/20",
              };

              const priceInputCls = naoTenho
                ? "border-neutral-200 dark:border-white/[0.05] text-neutral-300 dark:text-neutral-600 cursor-not-allowed bg-neutral-50 dark:bg-neutral-900"
                : priceError
                ? "border-danger-400/60 dark:border-danger-500/50 text-neutral-900 dark:text-white focus:border-danger-500 dark:focus:border-danger-400 focus:ring-2 focus:ring-danger-500/20"
                : currentPrice > 0
                ? "border-success-400 dark:border-success-500/50 text-success-900 dark:text-success-400 focus:border-success-500 dark:focus:border-success-400"
                : "border-neutral-300 dark:border-white/[0.1] text-neutral-900 dark:text-white focus:border-primary-500 dark:focus:border-primary-400";

              return (
                <div
                  key={cotacaoItem.id}
                  className={`p-6 hover:bg-neutral-50/30 dark:hover:bg-white/[0.01] transition-colors ${
                    naoTenho ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Left side: Image and Info */}
                    <div className="md:w-1/2 flex gap-4">
                      {imageUrl ? (
                        <div className="relative h-16 w-16 shrink-0 rounded-[var(--radius-md)] overflow-hidden bg-white/[0.06] border border-white/[0.05]">
                          <Image
                            src={imageUrl}
                            alt={cotacaoItem.nome_produto}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-[var(--radius-md)] bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.05] flex items-center justify-center">
                          <Package className="h-6 w-6 text-neutral-400" />
                        </div>
                      )}

                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white truncate">
                              {cotacaoItem.nome_produto}
                            </p>
                            {cotacaoItem.descricao && (
                              <p className="text-sm text-neutral-500 dark:text-neutral-400 italic mt-0.5 line-clamp-2">
                                {cotacaoItem.descricao}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold uppercase ${
                              unitBadgeStyle[unitType] ||
                              "bg-neutral-100 dark:bg-white/[0.05] text-neutral-500 dark:text-neutral-300 border-neutral-200 dark:border-white/[0.05]"
                            }`}
                          >
                            {unitType}
                          </span>
                          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                            Qtd: {cotacaoItem.quantidade}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveObsItem({
                                index,
                                id: cotacaoItem.id,
                                name: cotacaoItem.nome_produto,
                              })
                            }
                            disabled={isSubmitting}
                            className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                              itemObs
                                ? "text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                                : "text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <MessageSquarePlus className="h-4 w-4" />
                            {itemObs ? "Editar Obs" : "Deixar Obs"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Input and Toggles */}
                    <div className="md:w-1/2 flex flex-col justify-center space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                            Preço por{" "}
                            <span className="uppercase text-primary-500">
                              {unitType}
                            </span>{" "}
                            (R$) *
                          </label>
                          <div className="flex items-center gap-2">
                            {index > 0 && !naoTenho && (
                              <button
                                type="button"
                                onClick={() => repeatPreviousPrice(index)}
                                disabled={isSubmitting}
                                className="text-xs flex items-center gap-1 font-semibold text-neutral-500 dark:text-neutral-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors cursor-pointer bg-neutral-100 dark:bg-white/[0.05] px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Repetir valor do item acima"
                              >
                                <Copy className="h-3 w-3" /> Repetir
                              </button>
                            )}
                          </div>
                        </div>

                        <Controller
                          control={control}
                          name={`itens.${index}.preco_unitario`}
                          render={({ field }) => (
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="R$ 0,00"
                              value={formatCents(decimalToCents(field.value ?? 0))}
                              onChange={(e) => {
                                const cents = handleCentsInput(e.target.value);
                                field.onChange(centsToDecimal(cents));
                              }}
                              onBlur={field.onBlur}
                              disabled={naoTenho || isSubmitting}
                              className={`w-full h-16 bg-white dark:bg-neutral-900 border rounded-[var(--radius-md)] px-4 text-lg sm:text-xl font-bold outline-none transition-colors ${priceInputCls}`}
                              required={!naoTenho}
                            />
                          )}
                        />

                        {typeof priceError === "string" && !naoTenho && (
                          <p className="mt-1 text-xs font-semibold text-danger-600 dark:text-danger-400">
                            {priceError}
                          </p>
                        )}

                        {/* Suggested price (from previous proposal) */}
                        <div className="mt-2 min-h-[20px]">
                          {previousPrice !== undefined &&
                            previousPrice > 0 &&
                            !naoTenho && (
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                                <Info className="h-3 w-3 inline mr-1 text-primary-500" />
                                Preço sugerido:{" "}
                                <span className="font-bold text-neutral-700 dark:text-neutral-300">
                                  {formatCurrency(previousPrice)}
                                </span>
                              </p>
                            )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => toggleNaoTenho(index)}
                          disabled={isSubmitting}
                          className={`flex items-center gap-2 text-sm font-semibold transition-colors cursor-pointer px-4 py-2.5 rounded-[var(--radius-md)] ${
                            naoTenho
                              ? "bg-danger/10 text-danger dark:bg-danger-900/20 dark:text-danger-400"
                              : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.05]"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {naoTenho ? (
                            <ToggleRight className="h-5 w-5" />
                          ) : (
                            <ToggleLeft className="h-5 w-5" />
                          )}
                          Não tenho o produto
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-6 bg-neutral-50/50 dark:bg-white/[0.02]">
            <Textarea
              label="Observações Adicionais da Proposta (Opcional)"
              placeholder="Ex: Frete incluso, entrega em até 48h, validade do orçamento..."
              rows={5}
              error={errors.observacao?.message}
              {...register("observacao")}
            />
          </div>
        </form>
      </CardBody>

      <CardFooter className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-100 dark:border-white/[0.05] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col items-center sm:items-start text-neutral-500 dark:text-neutral-400 text-sm font-medium">
          Aviso: Os valores são unitários.
        </div>

        <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
          {!allFilled && (
            <p className="text-xs text-warning-600 dark:text-warning-400 flex items-center gap-1 font-semibold">
              <AlertCircle className="h-3 w-3" />
              Preencha ou marque todos os itens
            </p>
          )}
          <Button
            type="submit"
            form="proposta-form"
            loading={isSubmitting}
            disabled={!allFilled || isSubmitting}
            size="lg"
            className="w-full sm:w-auto px-10 h-14 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white border-none shadow-xl shadow-primary-500/20 active:scale-95 transition-all text-base font-bold"
          >
            Enviar Devolutiva
            <Send className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </CardFooter>

      <ObservationEditModal
        open={!!activeObsItem}
        onClose={() => setActiveObsItem(null)}
        onSave={(texto) => {
          if (!activeObsItem) return;
          setValue(`itens.${activeObsItem.index}.observacao`, texto, {
            shouldDirty: true,
          });
          setActiveObsItem(null);
        }}
        productName={activeObsItem?.name || ""}
        initialText={activeObsText || ""}
      />
    </Card>
  );
}
