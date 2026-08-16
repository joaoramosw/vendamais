"use client";

import {
  createSegmento,
  deleteSegmento,
  updateSegmento,
  type SegmentoWithCount,
} from "@/actions/fornecedor-segmentos";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { showToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { SegmentoFornecedoresModal } from "@/components/segmentos/SegmentoFornecedoresModal";
import { applySorting, useTableSort } from "@/lib/hooks/useTableSort";
import { ArrowUp, Edit, Plus, Search, Tags, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const SORT_HINT: Record<string, { asc: string; desc: string }> = {
  nome: { asc: "A → Z", desc: "Z → A" },
  fornecedores: { asc: "# ↑", desc: "# ↓" },
};

const COLOR_PRESETS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#64748b", "#f43f5e",
];

interface SegmentosTableProps {
  segmentos: SegmentoWithCount[];
}

export function SegmentosTable({ segmentos }: SegmentosTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editSegmento, setEditSegmento] = useState<SegmentoWithCount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteFornecedorCount, setDeleteFornecedorCount] = useState(0);
  // Segmento cujo resumo de fornecedores está aberto (clique no contador).
  const [fornecedoresSegmento, setFornecedoresSegmento] = useState<SegmentoWithCount | null>(null);
  const [loading, setLoading] = useState(false);

  const [formNome, setFormNome] = useState("");
  const [formCor, setFormCor] = useState("#6366f1");

  const { sortCriteria, toggleSort, getSortDirection, getSortIndex } = useTableSort();

  const getField = (s: SegmentoWithCount, col: string) => {
    switch (col) {
      case "nome":
        return s.nome;
      case "fornecedores":
        return s.fornecedor_count;
      default:
        return null;
    }
  };

  const displaySegmentos = useMemo(() => {
    const lower = searchQuery.toLowerCase().trim();
    const filtered = lower
      ? segmentos.filter((s) => s.nome.toLowerCase().includes(lower))
      : segmentos;

    return applySorting(filtered, sortCriteria, getField);
  }, [segmentos, searchQuery, sortCriteria]);

  const openCreate = () => {
    setFormNome("");
    setFormCor("#6366f1");
    setShowCreateModal(true);
  };

  const openEdit = (s: SegmentoWithCount) => {
    setFormNome(s.nome);
    setFormCor(s.cor ?? "#6366f1");
    setEditSegmento(s);
  };

  const openDelete = (s: SegmentoWithCount) => {
    setDeleteId(s.id);
    setDeleteFornecedorCount(s.fornecedor_count);
  };

  const handleCreate = async () => {
    setLoading(true);
    const fd = new FormData();
    fd.set("nome", formNome);
    fd.set("cor", formCor);
    const result = await createSegmento(fd);
    setLoading(false);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      showToast(`Segmento "${formNome}" criado!`, "success");
      setShowCreateModal(false);
      router.refresh();
    }
  };

  const handleUpdate = async () => {
    if (!editSegmento) return;
    setLoading(true);
    const fd = new FormData();
    fd.set("nome", formNome);
    fd.set("cor", formCor);
    const result = await updateSegmento(editSegmento.id, fd);
    setLoading(false);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      showToast("Segmento atualizado!", "success");
      setEditSegmento(null);
      router.refresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    const result = await deleteSegmento(deleteId);
    setLoading(false);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      showToast("Segmento excluído.", "success");
      setDeleteId(null);
      router.refresh();
    }
  };

  const renderSortableHeader = (colId: string, label: string, width?: string) => {
    const dir = getSortDirection(colId);
    const idx = getSortIndex(colId);
    const hint = SORT_HINT[colId];
    return (
      <TableHead key={colId} className={width}>
        <button
          type="button"
          onClick={() => toggleSort(colId)}
          className="flex items-center gap-1.5 text-inherit hover:text-primary-400 transition-colors cursor-pointer select-none w-full group/sort"
        >
          {label}
          {dir && hint && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-500/15 text-primary-400 whitespace-nowrap">
              {dir === "asc" ? hint.asc : hint.desc}
            </span>
          )}
          {!dir && (
            <ArrowUp className="h-3 w-3 text-neutral-600 opacity-0 group-hover/sort:opacity-100 transition-opacity" />
          )}
          {dir && sortCriteria.length > 1 && (
            <span className="text-[9px] text-primary-400/60 font-bold">{idx}</span>
          )}
        </button>
      </TableHead>
    );
  };

  const renderFormModal = (
    isOpen: boolean,
    title: string,
    onClose: () => void,
    onSubmit: () => void
  ) => (
    <Modal open={isOpen} onClose={onClose}>
      <ModalHeader onClose={onClose}>{title}</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <Input
            label="Nome *"
            placeholder="Ex: Cosméticos, Alimentos..."
            value={formNome}
            onChange={(e) => setFormNome(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Cor</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormCor(color)}
                  className={`h-8 w-8 rounded-full border-2 transition-all cursor-pointer ${
                    formCor === color
                      ? "border-white scale-110 shadow-lg"
                      : "border-transparent hover:border-white/40"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={formCor}
                onChange={(e) => setFormCor(e.target.value)}
                className="h-8 w-8 rounded-full cursor-pointer border-0 bg-transparent"
                title="Cor personalizada"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-5 w-5 rounded-full" style={{ backgroundColor: formCor }} />
              <span className="text-xs text-neutral-500 font-mono">{formCor}</span>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} loading={loading} disabled={!formNome.trim()}>
          {editSegmento ? "Salvar" : "Criar"}
        </Button>
      </ModalFooter>
    </Modal>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar segmento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
            />
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo Segmento
        </Button>
      </div>

      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/[0.06] rounded-[var(--radius-lg)] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Cor</TableHead>
                {renderSortableHeader("nome", "Nome")}
                {renderSortableHeader("fornecedores", "Fornecedores", "w-32")}
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displaySegmentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                        <Tags className="h-8 w-8 text-neutral-500" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">
                          Nenhum segmento encontrado
                        </p>
                        <p className="text-sm text-neutral-500 mt-1">
                          {searchQuery ? "Tente alterar a busca." : "Crie seu primeiro segmento."}
                        </p>
                      </div>
                      {!searchQuery && (
                        <Button size="sm" className="mt-2" onClick={openCreate}>
                          <Plus className="h-4 w-4" />
                          Novo Segmento
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displaySegmentos.map((s) => (
                  <TableRow key={s.id} className="group">
                    <TableCell>
                      <div
                        className="h-6 w-6 rounded-full border border-neutral-200 dark:border-white/10"
                        style={{ backgroundColor: s.cor || "#6366f1" }}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">{s.nome}</p>
                        <p className="text-[11px] text-neutral-500 font-mono">{s.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.fornecedor_count > 0 ? (
                        <Tooltip label="Ver os fornecedores deste segmento">
                          <button
                            type="button"
                            onClick={() => setFornecedoresSegmento(s)}
                            aria-label={`Ver os ${s.fornecedor_count} fornecedores de ${s.nome}`}
                            className="flex items-center gap-1.5 px-2 py-1 -mx-2 rounded-[var(--radius-md)] text-neutral-700 dark:text-neutral-300 hover:text-primary-400 hover:bg-primary-500/10 transition-colors cursor-pointer"
                          >
                            <Users className="h-3.5 w-3.5 text-neutral-500" />
                            <span className="text-sm font-medium underline decoration-dotted underline-offset-2">
                              {s.fornecedor_count}
                            </span>
                          </button>
                        </Tooltip>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-neutral-600" />
                          <span className="text-sm font-medium text-neutral-500">0</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 rounded-[var(--radius-md)] text-neutral-500 hover:text-primary-400 hover:bg-primary-500/10 transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDelete(s)}
                          className="p-1.5 rounded-[var(--radius-md)] text-neutral-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-xs text-neutral-500 text-right">
        {segmentos.length} segmento(s) • {segmentos.reduce((sum, s) => sum + s.fornecedor_count, 0)} fornecedor(es) classificado(s)
      </p>

      {renderFormModal(showCreateModal, "Novo Segmento", () => setShowCreateModal(false), handleCreate)}
      {renderFormModal(!!editSegmento, "Editar Segmento", () => setEditSegmento(null), handleUpdate)}

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir Segmento"
        description={
          deleteFornecedorCount > 0
            ? `⚠️ ${deleteFornecedorCount} fornecedor(es) estão classificados nesse segmento. A exclusão vai deixá-los sem segmento. Deseja continuar?`
            : "Tem certeza que deseja excluir este segmento? Esta ação não pode ser desfeita."
        }
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
        loading={loading}
        variant="danger"
      />

      {/* Resumo dos fornecedores do segmento */}
      <SegmentoFornecedoresModal
        segmento={fornecedoresSegmento}
        onClose={() => setFornecedoresSegmento(null)}
      />
    </div>
  );
}
