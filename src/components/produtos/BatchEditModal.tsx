"use client";

import { batchAddQuote, batchUpdateProducts } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { showToast } from "@/components/ui/toast";
import { useState } from "react";

interface BatchEditModalProps {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  categories: { id: string; name: string; color: string }[];
  onSuccess: () => void;
}

type EditField = "category" | "price";

export function BatchEditModal({
  open,
  onClose,
  selectedIds,
  categories,
  onSuccess,
}: BatchEditModalProps) {
  const [field, setField] = useState<EditField | "">("");
  const [value, setValue] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!field) return;
    setLoading(true);

    try {
      if (field === "category") {
        if (!value.trim()) {
          showToast("Insira uma categoria.", "warning");
          setLoading(false);
          return;
        }
        const result = await batchUpdateProducts(selectedIds, "category", value);
        if (result.error) {
          showToast(result.error, "error");
        } else {
          showToast(`${result.count} produto(s) atualizado(s)!`, "success");
          onSuccess();
          handleClose();
        }
      } else if (field === "price") {
        if (!companyName.trim() || !price) {
          showToast("Preencha empresa e preço.", "warning");
          setLoading(false);
          return;
        }
        const result = await batchAddQuote(
          selectedIds,
          companyName,
          parseFloat(price)
        );
        if (result.error) {
          showToast(result.error, "error");
        } else {
          showToast(`Cotação adicionada a ${result.count} produto(s)!`, "success");
          onSuccess();
          handleClose();
        }
      }
    } catch {
      showToast("Erro ao processar edição em lote.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setField("");
    setValue("");
    setCompanyName("");
    setPrice("");
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} className="max-w-md">
      <ModalHeader onClose={handleClose}>
        Editar {selectedIds.length} produto(s)
      </ModalHeader>
      <ModalBody className="space-y-4">
        <Select
          label="Qual campo deseja editar?"
          placeholder="Selecione..."
          options={[
            { value: "category", label: "Categoria" },
            { value: "price", label: "Preço (nova cotação)" },
          ]}
          value={field}
          onChange={(e) => {
            setField(e.target.value as EditField);
            setValue("");
            setCompanyName("");
            setPrice("");
          }}
        />

        {field === "category" && (
          <Input
            label="Nova categoria"
            placeholder="Ex: Bebidas, Limpeza..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            list="category-suggestions"
          />
        )}
        {field === "category" && categories.length > 0 && (
          <datalist id="category-suggestions">
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name} />
            ))}
          </datalist>
        )}

        {field === "price" && (
          <div className="space-y-3">
            <Input
              label="Empresa fornecedora"
              placeholder="Nome da empresa"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Input
              label="Preço unitário (R$)"
              placeholder="0,00"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} loading={loading} disabled={!field}>
          Aplicar alteração
        </Button>
      </ModalFooter>
    </Modal>
  );
}
