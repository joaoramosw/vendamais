"use client";

import { buscarProdutoPorBarcode } from "@/actions/cotacoes";
import {
    convidarPorUsuarios,
    enviarCotacao,
    salvarRascunho,
    type EnviarCotacaoItemPayload,
} from "@/lib/api/cotacoes-api";
import { FornecedorSelector } from "@/components/cotacoes/FornecedorSelector";
import { ProdutoNomeAutocomplete } from "@/components/produtos/ProdutoNomeAutocomplete";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { CATEGORIAS, UNIT_TYPE_LABELS, UNIT_TYPES, type UnitType } from "@/lib/constants";
import {
    ArrowLeft,
    ArrowRight,
    Barcode,
    ChevronDown,
    Info,
    Package,
    Plus,
    Save,
    Search,
    Send,
    Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

/* ─── Step definitions ─── */
const steps: StepperStep[] = [
  { label: "Dados básicos", description: "Título e prazo" },
  { label: "Itens", description: "Produtos e quantidades" },
  { label: "Revisão", description: "Confirmar e enviar" },
];

interface ItemForm {
  id: string;
  nome_produto: string;
  descricao: string;
  codigo_barras: string;
  categoria: string;
  estoque_atual: string;
  quantidade_sugerida: string;
  tipo_unidade: UnitType;
  observacao: string;
  product_id?: string;
  // internal state
  _barcodeLoading?: boolean;
  _barcodeFound?: boolean;
}

const defaultItem = (): ItemForm => ({
  id: String(Date.now() + Math.random()),
  nome_produto: "",
  descricao: "",
  codigo_barras: "",
  categoria: "outros",
  estoque_atual: "",
  quantidade_sugerida: "1",
  tipo_unidade: "UN",
  observacao: "",
});

export default function NovaCotacaoPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publishingRef = useRef(false);

  // Step 1 — Dados básicos
  const [titulo, setTitulo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fornecedoresSelecionados, setFornecedoresSelecionados] = useState<Set<string>>(new Set());

  // Step 2 — Itens
  const [itens, setItens] = useState<ItemForm[]>([defaultItem()]);
  const [bulkUnit, setBulkUnit] = useState<UnitType>("UN");

  /* ─── Item helpers ─── */
  const addItem = () => setItens((prev) => [...prev, defaultItem()]);

  const removeItem = (id: string) => {
    if (itens.length > 1) setItens(itens.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof ItemForm, value: string) => {
    setItens(itens.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const applyBulkUnit = () => {
    setItens(itens.map((item) => ({ ...item, tipo_unidade: bulkUnit })));
  };

  async function handleBarcodeSearch(itemId: string, barcode: string) {
    if (!barcode.trim()) return;
    setItens((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, _barcodeLoading: true, _barcodeFound: undefined } : i))
    );
    try {
      const product = await buscarProdutoPorBarcode(barcode.trim());
      if (product) {
        setItens((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  nome_produto: product.name,
                  descricao: product.description || "",
                  categoria: product.category || "outros",
                  product_id: product.id,
                  _barcodeLoading: false,
                  _barcodeFound: true,
                }
              : i
          )
        );
      } else {
        setItens((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, _barcodeLoading: false, _barcodeFound: false } : i
          )
        );
      }
    } catch {
      setItens((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, _barcodeLoading: false } : i))
      );
    }
  }

  /* ─── Navigation ─── */
  const next = () => {
    if (currentStep === 0) {
      if (!titulo.trim()) { setError("Título é obrigatório."); return; }
      setError(null);
    }
    if (currentStep === 1) {
      const valid = itens.filter((i) => i.nome_produto.trim());
      if (valid.length === 0) { setError("Adicione pelo menos um item com nome."); return; }
      setError(null);
    }
    setCurrentStep(currentStep + 1);
  };

  const prev = () => setCurrentStep(currentStep - 1);

  function buildItensPayload(): EnviarCotacaoItemPayload[] {
    return itens
      .filter((item) => item.nome_produto.trim())
      .map((item) => ({
        nome_produto: item.nome_produto.trim(),
        descricao: item.descricao || undefined,
        codigo_barras: item.codigo_barras || undefined,
        categoria: item.categoria,
        estoque_atual: item.estoque_atual ? parseFloat(item.estoque_atual) : undefined,
        quantidade_sugerida: item.quantidade_sugerida ? parseFloat(item.quantidade_sugerida) : 1,
        unidade: item.tipo_unidade,
        tipo_unidade: item.tipo_unidade,
        quantidade: item.quantidade_sugerida ? parseFloat(item.quantidade_sugerida) : 1,
        observacao: item.observacao || undefined,
        product_id: item.product_id,
      }));
  }

  async function handleSaveDraft() {
    setLoading(true);
    setError(null);

    const result = await salvarRascunho({
      titulo,
      data_limite: prazo || undefined,
      itens: buildItensPayload(),
    });

    if (!result.success) {
      setError(result.error);
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success("Rascunho salvo com sucesso!");
    router.push("/empresario/cotacoes");
  }

  async function handlePublish() {
    if (publishingRef.current) return;
    publishingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Backend novo faz criar -> publicar em 1 chamada, sem depender do embed
      // PostgREST cotacoes<->cotacao_itens (a FK que nunca existiu no banco real).
      const result = await enviarCotacao({
        titulo,
        data_limite: prazo || undefined,
        itens: buildItensPayload(),
      });

      if (!result.success) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      if (fornecedoresSelecionados.size > 0) {
        try {
          const criados = await convidarPorUsuarios(result.id, Array.from(fornecedoresSelecionados));
          if (criados.length > 0) {
            toast.success(`${criados.length} fornecedor(es) convidado(s)!`);
          }
        } catch (conviteError) {
          toast.warning(
            conviteError instanceof Error
              ? `Cotação publicada, mas houve erro ao convidar fornecedores: ${conviteError.message}`
              : "Cotação publicada, mas houve erro ao convidar fornecedores.",
          );
        }
      }

      toast.success("Cotação publicada com sucesso! Fornecedores já podem enviar propostas.");
      // Mesmo destino do envio pela lista de cotação: abre a cotação recém-
      // criada, em vez de deixar o usuário procurar o card na listagem.
      router.push(`/empresario/cotacoes/${result.id}`);
    } finally {
      publishingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/empresario/cotacoes"
          className="p-2 rounded-[var(--radius-md)] text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Nova Cotação</h1>
          <p className="text-sm text-neutral-400">
            Defina os itens e as unidades para que os fornecedores respondam corretamente
          </p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper steps={steps} currentStep={currentStep} />

      {error && (
        <div className="bg-danger-500/10 text-danger-400 p-4 rounded-[var(--radius-lg)] border border-danger-500/20 text-sm flex gap-3 animate-fade-in">
          <Info className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Step Content */}
      <Card>
        <CardBody className="space-y-6">

          {/* ─── Step 1: Dados básicos ─── */}
          {currentStep === 0 && (
            <div className="space-y-4 animate-fade-in">
              <Input
                label="Título da cotação *"
                placeholder="Ex: Compra mensal de hortifrúti"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                autoFocus
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Data limite para propostas"
                  type="datetime-local"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                />
              </div>
              <Textarea
                label="Descrição / Observações Gerais"
                placeholder="Condições de entrega, requisitos especiais, etc."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-400">
                  Convidar fornecedores ao publicar (opcional)
                </label>
                <FornecedorSelector
                  selected={fornecedoresSelecionados}
                  onChange={setFornecedoresSelecionados}
                />
              </div>
            </div>
          )}

          {/* ─── Step 2: Itens ─── */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-fade-in">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                <p className="text-sm text-neutral-400">
                  Adicione os produtos para cotar. Os fornecedores verão: nome, barcode, categoria e unidade.
                </p>
                <div className="flex items-center gap-2">
                  {/* Bulk unit selector */}
                  <div className="flex items-center gap-2 bg-white/[0.04] rounded-[var(--radius-md)] px-3 py-1.5 border border-white/[0.06]">
                    <span className="text-xs text-neutral-400 whitespace-nowrap">Def. todos:</span>
                    <select
                      value={bulkUnit}
                      onChange={(e) => setBulkUnit(e.target.value as UnitType)}
                      className="bg-transparent text-xs text-white border-none outline-none cursor-pointer"
                    >
                      {UNIT_TYPES.map((u) => (
                        <option key={u} value={u} className="bg-neutral-900">
                          {UNIT_TYPE_LABELS[u]}
                        </option>
                      ))}
                    </select>
                    <Button variant="ghost" size="sm" onClick={applyBulkUnit} className="h-6 px-2 text-xs">
                      Aplicar
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4" />
                    Novo Item
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {itens.map((item, index) => (
                  <div
                    key={item.id}
                    className="relative p-4 bg-neutral-900 rounded-[var(--radius-lg)] border border-white/[0.06] group animate-fade-in"
                  >
                    {/* Item header */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                        <Package className="h-3.5 w-3.5" />
                        Item {index + 1}
                      </span>
                      {itens.length > 1 && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-neutral-600 hover:text-danger-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Row 1: Barcode search + Nome */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-4 relative">
                          <Input
                            label="Código de Barras"
                            placeholder="Escanear ou digitar..."
                            value={item.codigo_barras}
                            onChange={(e) => updateItem(item.id, "codigo_barras", e.target.value)}
                            onBlur={(e) => handleBarcodeSearch(item.id, e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => handleBarcodeSearch(item.id, item.codigo_barras)}
                            className="absolute right-2 bottom-2 p-1 text-neutral-500 hover:text-primary-400 transition-colors cursor-pointer"
                          >
                            {item._barcodeLoading ? (
                              <Search className="h-4 w-4 animate-pulse" />
                            ) : (
                              <Barcode className="h-4 w-4" />
                            )}
                          </button>
                          {item._barcodeFound === true && (
                            <p className="text-[10px] text-success-400 mt-1">✓ Produto encontrado no catálogo</p>
                          )}
                          {item._barcodeFound === false && (
                            <p className="text-[10px] text-yellow-500 mt-1">Produto não encontrado — preencha manualmente</p>
                          )}
                        </div>
                        <div className="md:col-span-8">
                          <ProdutoNomeAutocomplete
                            value={item.nome_produto}
                            onChange={(value) => updateItem(item.id, "nome_produto", value)}
                            onSelectProduto={(produto) => {
                              setItens((prev) =>
                                prev.map((i) =>
                                  i.id === item.id
                                    ? {
                                        ...i,
                                        nome_produto: produto.name,
                                        descricao: produto.description || "",
                                        categoria: produto.category || "outros",
                                        product_id: produto.id,
                                        _barcodeFound: true,
                                      }
                                    : i
                                )
                              );
                            }}
                          />
                        </div>
                      </div>

                      {/* Row 2: Categoria + Descrição */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-4">
                          <Select
                            label="Categoria"
                            options={CATEGORIAS.map((c) => ({ value: c.value, label: c.label }))}
                            value={item.categoria}
                            onChange={(e) => updateItem(item.id, "categoria", e.target.value)}
                          />
                        </div>
                        <div className="md:col-span-8">
                          <Input
                            label="Descrição (opcional)"
                            placeholder="Marca, sabor, tamanho, etc."
                            value={item.descricao}
                            onChange={(e) => updateItem(item.id, "descricao", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Row 3: Estoque | Qtd Sugerida | Unidade */}
                      <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
                        <div className="col-span-1 md:col-span-3">
                          <Input
                            label="Estoque Atual"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={item.estoque_atual}
                            onChange={(e) => updateItem(item.id, "estoque_atual", e.target.value)}
                          />
                          <p className="text-[10px] text-neutral-600 mt-1">Interno — não visível ao fornecedor</p>
                        </div>
                        <div className="col-span-1 md:col-span-3">
                          <Input
                            label="Qtd a Comprar *"
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantidade_sugerida}
                            onChange={(e) => updateItem(item.id, "quantidade_sugerida", e.target.value)}
                          />
                        </div>
                        <div className="col-span-2 md:col-span-3">
                          <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                            Unidade Comercial *
                          </label>
                          <div className="relative">
                            <select
                              value={item.tipo_unidade}
                              onChange={(e) => updateItem(item.id, "tipo_unidade", e.target.value as UnitType)}
                              className="w-full h-10 bg-neutral-800 border border-white/[0.08] rounded-[var(--radius-md)] text-white text-sm pl-3 pr-8 appearance-none outline-none focus:border-primary-500 transition-colors cursor-pointer"
                            >
                              {UNIT_TYPES.map((u) => (
                                <option key={u} value={u} className="bg-neutral-900">
                                  {u} — {UNIT_TYPE_LABELS[u]}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-neutral-500 pointer-events-none" />
                          </div>
                          <p className="text-[10px] text-neutral-600 mt-1">
                            Fornecedor cotará preço por {UNIT_TYPE_LABELS[item.tipo_unidade]}
                          </p>
                        </div>
                        <div className="col-span-2 md:col-span-3">
                          <Input
                            label="Observação"
                            placeholder="Especificação..."
                            value={item.observacao}
                            onChange={(e) => updateItem(item.id, "observacao", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="secondary" onClick={addItem} className="w-full">
                <Plus className="h-4 w-4" />
                Adicionar outro item
              </Button>
            </div>
          )}

          {/* ─── Step 3: Revisão ─── */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-primary-500/10 p-4 rounded-[var(--radius-lg)] border border-primary-500/20">
                <h3 className="text-sm font-semibold text-primary-300 mb-2">Dados da Cotação</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-neutral-300">
                  <p><span className="font-medium">Título:</span> {titulo}</p>
                  <p><span className="font-medium">Prazo:</span> {prazo ? new Date(prazo).toLocaleString("pt-BR") : "Não definido"}</p>
                  {descricao && <p className="col-span-2 text-neutral-400 italic">{descricao}</p>}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-white mb-3">
                  Itens ({itens.filter((i) => i.nome_produto).length})
                </h3>
                <div className="border border-white/[0.06] rounded-[var(--radius-md)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.04] text-neutral-400 text-xs uppercase font-medium">
                      <tr>
                        <th className="px-4 py-3 text-left">Produto</th>
                        <th className="px-4 py-3 text-left">Barcode</th>
                        <th className="px-4 py-3 text-left">Categoria</th>
                        <th className="px-4 py-3 text-center">Estoque</th>
                        <th className="px-4 py-3 text-center">Qtd</th>
                        <th className="px-4 py-3 text-center">Unidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {itens
                        .filter((i) => i.nome_produto)
                        .map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <p className="text-neutral-200 font-medium">{item.nome_produto}</p>
                              {item.descricao && (
                                <p className="text-[10px] text-neutral-500 italic mt-0.5">{item.descricao}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-neutral-400 font-mono text-xs">
                              {item.codigo_barras || "—"}
                            </td>
                            <td className="px-4 py-3 text-neutral-400 capitalize">
                              {item.categoria || "—"}
                            </td>
                            <td className="px-4 py-3 text-center text-neutral-500 text-xs">
                              {item.estoque_atual || "—"}
                            </td>
                            <td className="px-4 py-3 text-center text-neutral-300 font-medium">
                              {item.quantidade_sugerida || 1}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/10 text-primary-400 rounded text-xs font-bold">
                                {item.tipo_unidade}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-success-500/5 border border-success-500/10 rounded-[var(--radius-lg)]">
                <Info className="h-4 w-4 text-success-400 mt-0.5 shrink-0" />
                <p className="text-xs text-success-400/80 leading-relaxed">
                  Os fornecedores receberão: <strong>Nome, Barcode, Categoria</strong> e a <strong>Unidade Comercial</strong>.
                  Campos de <em>Estoque</em> não serão compartilhados.
                </p>
              </div>
            </div>
          )}
        </CardBody>

        {/* Step Navigation */}
        <CardFooter>
          {currentStep > 0 && (
            <Button variant="ghost" onClick={prev} disabled={loading}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          <div className="flex-1" />
          {currentStep < steps.length - 1 ? (
            <Button onClick={next}>
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handleSaveDraft} loading={loading} disabled={loading}>
                <Save className="h-4 w-4" />
                Salvar Rascunho
              </Button>
              <Button onClick={handlePublish} loading={loading} disabled={loading}>
                <Send className="h-4 w-4" />
                Publicar Cotação
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
