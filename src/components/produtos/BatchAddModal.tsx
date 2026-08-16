"use client";

import { createProduct } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
} from "@/components/ui/modal";
import { showToast } from "@/components/ui/toast";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface BatchAddModalProps {
  open: boolean;
  onClose: () => void;
  categories: { id: string; name: string; color: string }[];
  onSuccess: () => void;
}

interface BatchRow {
  name: string;
  category: string;
  barcode: string;
}

const emptyRow = (): BatchRow => ({ name: "", category: "", barcode: "" });

export function BatchAddModal({
  open,
  onClose,
  categories,
  onSuccess,
}: BatchAddModalProps) {
  const [rows, setRows] = useState<BatchRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [loading, setLoading] = useState(false);

  const updateRow = (index: number, field: keyof BatchRow, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const validRows = rows.filter((r) => r.name.trim());
    if (validRows.length === 0) {
      showToast("Preencha ao menos um nome de produto.", "warning");
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of validRows) {
      try {
        const formData = new FormData();
        formData.set("name", row.name);
        formData.set("description", "");
        formData.set("barcode", row.barcode);
        formData.set("category", row.category);
        formData.set("image_url", "");

        const result = await createProduct(formData);
        if (result.error) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch {
        errorCount++;
      }
    }

    if (successCount > 0) {
      showToast(`${successCount} produto(s) criado(s) com sucesso!`, "success");
      onSuccess();
    }
    if (errorCount > 0) {
      showToast(`${errorCount} produto(s) com erro ao criar.`, "error");
    }

    setLoading(false);
    handleClose();
  };

  const handleClose = () => {
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} className="max-w-2xl">
      <ModalHeader onClose={handleClose}>Adicionar Produtos em Lote</ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-sm text-neutral-400">
          Preencha os dados para cadastrar múltiplos produtos de uma vez.
        </p>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2 text-xs font-medium text-neutral-400 px-1">
          <span>Nome *</span>
          <span>Categoria</span>
          <span>Cód. Barras</span>
          <span />
        </div>

        {/* Rows */}
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2 items-center animate-fade-in"
            >
              <Input
                placeholder="Nome do produto"
                value={row.name}
                onChange={(e) => updateRow(index, "name", e.target.value)}
              />
              <Input
                placeholder="Categoria"
                value={row.category}
                onChange={(e) => updateRow(index, "category", e.target.value)}
                list="batch-cat-list"
              />
              <Input
                placeholder="EAN-13..."
                value={row.barcode}
                onChange={(e) => updateRow(index, "barcode", e.target.value)}
              />
              <button
                onClick={() => removeRow(index)}
                disabled={rows.length <= 1}
                className="p-1.5 rounded-[var(--radius-md)] text-neutral-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remover linha"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {categories.length > 0 && (
          <datalist id="batch-cat-list">
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name} />
            ))}
          </datalist>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={addRow}
          className="text-primary-400"
        >
          <Plus className="h-4 w-4" />
          Adicionar linha
        </Button>

        {/* Future import tab placeholder */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-white/[0.03] border border-white/[0.06]">
          <span className="text-xs text-neutral-500">
            📥 Importação via arquivo — em breve
          </span>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          Salvar todos
        </Button>
      </ModalFooter>
    </Modal>
  );
}
