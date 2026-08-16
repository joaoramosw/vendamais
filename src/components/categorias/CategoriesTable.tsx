"use client";

import {
    createCategory,
    deleteCategory,
    updateCategory,
} from "@/actions/categories";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
} from "@/components/ui/modal";
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
import { CategoryProductsModal } from "@/components/categorias/CategoryProductsModal";
import {
    applySorting,
    useTableSort,
} from "@/lib/hooks/useTableSort";
import type { CategoryWithCount } from "@/lib/types/database";
import {
    ArrowUp,
    Edit,
    Package,
    Plus,
    Search,
    Tags,
    Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

/* ─── Sort label helper ─── */
const SORT_HINT: Record<string, { asc: string; desc: string }> = {
  nome: { asc: "A → Z", desc: "Z → A" },
  produtos: { asc: "# ↑", desc: "# ↓" },
};

/* ─── Color presets ─── */
const COLOR_PRESETS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#64748b", "#f43f5e",
];

interface CategoriesTableProps {
  categories: CategoryWithCount[];
}

export function CategoriesTable({ categories }: CategoriesTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryWithCount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteProductCount, setDeleteProductCount] = useState(0);
  // Categoria cujo resumo de produtos está aberto (clique no contador).
  const [productsCategory, setProductsCategory] = useState<CategoryWithCount | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState("#6366f1");

  // Sorting
  const { sortCriteria, toggleSort, getSortDirection, getSortIndex } = useTableSort();

  const getField = (cat: CategoryWithCount, col: string) => {
    switch (col) {
      case "nome": return cat.name;
      case "produtos": return cat.product_count;
      default: return null;
    }
  };

  // Filtered + sorted
  const displayCategories = useMemo(() => {
    const lower = searchQuery.toLowerCase().trim();
    const filtered = lower
      ? categories.filter(
          (c) =>
            c.name.toLowerCase().includes(lower) ||
            (c.description ?? "").toLowerCase().includes(lower)
        )
      : categories;

    return applySorting(filtered, sortCriteria, getField);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, searchQuery, sortCriteria]);

  /* ─── Open modals ─── */
  const openCreate = () => {
    setFormName("");
    setFormDescription("");
    setFormColor("#6366f1");
    setShowCreateModal(true);
  };

  const openEdit = (cat: CategoryWithCount) => {
    setFormName(cat.name);
    setFormDescription(cat.description ?? "");
    setFormColor(cat.color ?? "#6366f1");
    setEditCategory(cat);
  };

  const openDelete = (cat: CategoryWithCount) => {
    setDeleteId(cat.id);
    setDeleteProductCount(cat.product_count);
  };

  /* ─── Actions ─── */
  const handleCreate = async () => {
    setLoading(true);
    const fd = new FormData();
    fd.set("name", formName);
    fd.set("description", formDescription);
    fd.set("color", formColor);
    const result = await createCategory(fd);
    setLoading(false);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      showToast(`Categoria "${formName}" criada!`, "success");
      setShowCreateModal(false);
      router.refresh();
    }
  };

  const handleUpdate = async () => {
    if (!editCategory) return;
    setLoading(true);
    const fd = new FormData();
    fd.set("name", formName);
    fd.set("description", formDescription);
    fd.set("color", formColor);
    const result = await updateCategory(editCategory.id, fd);
    setLoading(false);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      showToast(`Categoria atualizada!`, "success");
      setEditCategory(null);
      router.refresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    const result = await deleteCategory(deleteId);
    setLoading(false);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      showToast("Categoria excluída.", "success");
      setDeleteId(null);
      router.refresh();
    }
  };

  /* ─── Sortable header helper ─── */
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

  /* ─── Category Form Modal ─── */
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
            placeholder="Ex: Alimentos, Bebidas..."
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Input
            label="Descrição"
            placeholder="Descrição opcional..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Cor
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormColor(color)}
                  className={`h-8 w-8 rounded-full border-2 transition-all cursor-pointer ${
                    formColor === color
                      ? "border-white scale-110 shadow-lg"
                      : "border-transparent hover:border-white/40"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="h-8 w-8 rounded-full cursor-pointer border-0 bg-transparent"
                title="Cor personalizada"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div
                className="h-5 w-5 rounded-full"
                style={{ backgroundColor: formColor }}
              />
              <span className="text-xs text-neutral-500 font-mono">{formColor}</span>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} loading={loading} disabled={!formName.trim()}>
          {editCategory ? "Salvar" : "Criar"}
        </Button>
      </ModalFooter>
    </Modal>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
            />
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/[0.06] rounded-[var(--radius-lg)] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Cor</TableHead>
                {renderSortableHeader("nome", "Nome")}
                <TableHead className="w-64">Descrição</TableHead>
                {renderSortableHeader("produtos", "Produtos", "w-28")}
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                        <Tags className="h-8 w-8 text-neutral-500" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">
                          Nenhuma categoria encontrada
                        </p>
                        <p className="text-sm text-neutral-500 mt-1">
                          {searchQuery
                            ? "Tente alterar a busca."
                            : "Crie sua primeira categoria."}
                        </p>
                      </div>
                      {!searchQuery && (
                        <Button size="sm" className="mt-2" onClick={openCreate}>
                          <Plus className="h-4 w-4" />
                          Nova Categoria
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayCategories.map((cat) => (
                  <TableRow key={cat.id} className="group">
                    <TableCell>
                      <div
                        className="h-6 w-6 rounded-full border border-neutral-200 dark:border-white/10"
                        style={{ backgroundColor: cat.color || "#6366f1" }}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
                          {cat.name}
                        </p>
                        <p className="text-[11px] text-neutral-500 font-mono">
                          {cat.slug}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-neutral-400 line-clamp-1">
                        {cat.description || (
                          <span className="text-neutral-600 italic text-xs">—</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {cat.product_count > 0 ? (
                        <Tooltip label="Ver os produtos desta categoria">
                          <button
                            type="button"
                            onClick={() => setProductsCategory(cat)}
                            aria-label={`Ver os ${cat.product_count} produtos de ${cat.name}`}
                            className="flex items-center gap-1.5 px-2 py-1 -mx-2 rounded-[var(--radius-md)] text-neutral-700 dark:text-neutral-300 hover:text-primary-400 hover:bg-primary-500/10 transition-colors cursor-pointer"
                          >
                            <Package className="h-3.5 w-3.5 text-neutral-500" />
                            <span className="text-sm font-medium underline decoration-dotted underline-offset-2">
                              {cat.product_count}
                            </span>
                          </button>
                        </Tooltip>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-neutral-600" />
                          <span className="text-sm font-medium text-neutral-500">0</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(cat)}
                          className="p-1.5 rounded-[var(--radius-md)] text-neutral-500 hover:text-primary-400 hover:bg-primary-500/10 transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDelete(cat)}
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

      {/* Stat */}
      <p className="text-xs text-neutral-500 text-right">
        {categories.length} categoria(s) • {categories.reduce((s, c) => s + c.product_count, 0)} associação(ões)
      </p>

      {/* Create Modal */}
      {renderFormModal(showCreateModal, "Nova Categoria", () => setShowCreateModal(false), handleCreate)}

      {/* Edit Modal */}
      {renderFormModal(!!editCategory, "Editar Categoria", () => setEditCategory(null), handleUpdate)}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Excluir Categoria"
        description={
          deleteProductCount > 0
            ? `⚠️ Esta categoria está associada a ${deleteProductCount} produto(s). A exclusão removerá apenas a associação, os produtos não serão excluídos. Deseja continuar?`
            : "Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
        }
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
        loading={loading}
        variant="danger"
      />

      {/* Resumo dos produtos da categoria */}
      <CategoryProductsModal
        category={productsCategory}
        onClose={() => setProductsCategory(null)}
      />
    </div>
  );
}
