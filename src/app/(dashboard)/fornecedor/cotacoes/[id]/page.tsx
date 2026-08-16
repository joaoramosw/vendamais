import { getCotacaoParaFornecedor } from "@/actions/cotacoes";
import { EnviarPropostaForm } from "@/components/forms/enviar-proposta-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { COTACAO_STATUS_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    CheckCircle2,
    Clock,
    FileText
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function FornecedorCotacaoDetalhesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Use supplier-safe query (omits estoque_atual, quantidade_sugerida)
  const cotacao = await getCotacaoParaFornecedor(id).catch(() => null);
  if (!cotacao) notFound();

  // Defense-in-depth: suppliers should never see draft quotations
  if (cotacao.status === "rascunho") notFound();

  // Check if the quotation is closed (no longer accepting proposals)
  const isClosed = cotacao.status === "encerrada";

  // Check if already proposed + get previous prices for reference
  const { data: existingProposta } = await supabase
    .from("propostas")
    .select(`
      id, status,
      proposta_itens (cotacao_item_id, preco_unitario)
    `)
    .eq("cotacao_id", id)
    .eq("fornecedor_id", user.id)
    .maybeSingle();

  // Build previous prices map for reference display
  const previousPrices: Record<string, number> = {};
  if (existingProposta?.proposta_itens) {
    for (const pi of existingProposta.proposta_itens as any[]) {
      previousPrices[pi.cotacao_item_id] = pi.preco_unitario;
    }
  }

  const unitBadgeStyle: Record<string, string> = {
    UN: "bg-info-500/10 text-info-400 border-info-500/20",
    CX: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    DZ: "bg-warning-500/10 text-warning-400 border-warning-500/20",
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/fornecedor/cotacoes"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para oportunidades
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{cotacao.titulo}</h1>
              <Badge variant="success" dot>
                {COTACAO_STATUS_LABELS[cotacao.status as keyof typeof COTACAO_STATUS_LABELS]}
              </Badge>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Empresa:{" "}
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                {(cotacao as any).profiles?.empresa || (cotacao as any).profiles?.nome}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 bg-neutral-100 dark:bg-white/[0.05] px-4 py-2 rounded-full text-xs font-bold text-neutral-600 dark:text-neutral-400">
            <Clock className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
            PRAZO: {cotacao.data_limite ? formatDate(cotacao.data_limite) : "A definir"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quotation Details */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-neutral-50/50 dark:bg-white/[0.02] border-none dark:border-white/[0.05]">
            <CardHeader>
              <CardTitle className="text-base text-neutral-900 dark:text-white">Informações do Pedido</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] text-neutral-400 font-bold uppercase">
                  Descrição / Observações
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed italic bg-white/[0.02] border border-white/[0.05] p-3 rounded-lg">
                  {/* cotacoes has no descricao column on the live schema — see CLAUDE.md "Known Issues" */}
                  &ldquo;Sem observações adicionais.&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-neutral-100 dark:border-white/[0.08] flex items-center justify-between">
                <div className="text-center">
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">
                    {(cotacao as any).cotacao_itens?.length || 0}
                  </p>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase">Itens</p>
                </div>
                <div className="h-8 w-px bg-neutral-200 dark:bg-white/[0.1]" />
                <div className="text-center">
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">{formatDate(cotacao.created_at)}</p>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase">Publicada</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Proposal Form */}
        <div className="lg:col-span-2">
          {isClosed ? (
            <Card className="border-neutral-500/20 bg-neutral-500/[0.03]">
              <CardBody className="p-8 flex flex-col items-center text-center gap-6">
                <div className="h-20 w-20 bg-neutral-500/15 text-neutral-400 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-12 w-12" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Cotação Encerrada</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
                    Esta cotação já foi encerrada e não está mais aceitando novas propostas.
                  </p>
                </div>
                <Link href="/fornecedor/cotacoes" className="inline-block">
                  <Button variant="ghost" className="text-primary-600 dark:text-primary-400 dark:hover:bg-primary-900/30">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para oportunidades
                  </Button>
                </Link>
              </CardBody>
            </Card>
          ) : existingProposta ? (
            <div className="space-y-6 animate-fade-in">
              <Card className="border-primary-100 bg-primary-50/10 dark:border-primary-900/30 dark:bg-primary-900/10">
                <CardBody className="p-8 flex flex-col items-center text-center gap-6">
                  <div className="h-20 w-20 bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Proposta Já Enviada</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
                      Você já enviou um orçamento para esta cotação. Agora basta aguardar o retorno do
                      empresário.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                    <Badge variant="enviada" className="px-6 py-2 text-sm">
                      Status: {existingProposta.status}
                    </Badge>
                  </div>

                  <Link href="/fornecedor/propostas" className="inline-block">
                    <Button variant="ghost" className="text-primary-600 dark:text-primary-400 dark:hover:bg-primary-900/30">
                      <FileText className="h-4 w-4" />
                      Ver todos meus orçamentos
                    </Button>
                  </Link>
                </CardBody>
              </Card>

              <div className="p-6 bg-neutral-50 dark:bg-white/[0.02] rounded-[var(--radius-lg)] border border-neutral-100 dark:border-white/[0.05] flex items-start gap-4">
                <AlertCircle className="h-5 w-5 text-neutral-400 dark:text-neutral-500 mt-0.5" />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed italic">
                  Nota: Se precisar alterar valores, entre em contato com o empresário diretamente.
                </p>
              </div>
            </div>
          ) : (
            <EnviarPropostaForm
              cotacaoId={cotacao.id}
              cotacaoItens={(cotacao as any).cotacao_itens ?? []}
              previousPrices={previousPrices}
            />
          )}
        </div>
      </div>
    </div>
  );
}
