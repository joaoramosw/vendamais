import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useEffect, useState } from "react";

interface ObservationEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (texto: string) => void;
  productName: string;
  initialText?: string;
}

const MAX_CHARS = 200;

export function ObservationEditModal({
  open,
  onClose,
  onSave,
  productName,
  initialText = "",
}: ObservationEditModalProps) {
  const [texto, setTexto] = useState(initialText);

  // Update internal state when initialText changes (e.g. opening a different item)
  useEffect(() => {
    if (open) {
      setTexto(initialText);
    }
  }, [open, initialText]);

  const charsLeft = MAX_CHARS - texto.length;
  const isOverLimit = charsLeft < 0;
  const isEmpty = texto.trim().length === 0;

  const handleSave = () => {
    if (isEmpty || isOverLimit) return;
    onSave(texto.trim());
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <ModalHeader onClose={onClose}>
        {initialText ? "Editar Observação" : "Adicionar Observação"}
      </ModalHeader>
      <ModalBody className="space-y-4">
        <div>
          <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">Produto</span>
          <p className="text-sm text-neutral-800 dark:text-neutral-200 mt-1 font-medium bg-neutral-100 dark:bg-neutral-900 p-2.5 rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/[0.08]">
            {productName}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="obs-text" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Sua nota (visível para o empresário):
          </label>
          <textarea
            id="obs-text"
            placeholder="Ex: Entrega a partir de sexta-feira..."
            value={texto}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTexto(e.target.value)}
            className={`w-full min-h-[100px] bg-neutral-50 dark:bg-neutral-900 border rounded-[var(--radius-md)] p-3 text-sm text-neutral-800 dark:text-neutral-200 outline-none transition-colors resize-none ${
              isOverLimit ? "border-danger-500/50 focus-visible:ring-danger-500/20" : "border-neutral-200 dark:border-white/[0.08] focus:border-primary-500"
            }`}
          />
          <div className="flex justify-between items-center text-xs">
            <span className={isOverLimit ? "text-danger-400 font-medium" : "text-neutral-500"}>
              {texto.length} / {MAX_CHARS} caracteres
            </span>
            {isOverLimit && (
              <span className="text-danger-400 font-medium">Limite excedido</span>
            )}
          </div>
        </div>
      </ModalBody>
      <ModalFooter className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={isEmpty || isOverLimit}
        >
          Salvar Nota
        </Button>
      </ModalFooter>
    </Modal>
  );
}
