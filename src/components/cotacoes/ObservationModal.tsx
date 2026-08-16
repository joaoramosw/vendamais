import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { AlertCircle } from "lucide-react";

interface ObservationModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  observation: {
    texto: string;
    autor: string;
  } | null;
  onEdit?: () => void;
}

export function ObservationModal({
  open,
  onClose,
  productName,
  observation,
  onEdit,
}: ObservationModalProps) {
  if (!observation) return null;

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <ModalHeader onClose={onClose}>Observação do Produto</ModalHeader>
      <ModalBody className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-[var(--radius-md)]">
          <div className="bg-yellow-500 p-1.5 rounded-full shrink-0 animate-pulse mt-0.5">
            <AlertCircle className="h-4 w-4 text-yellow-950" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium text-yellow-500">
              Nota deixada por: {observation.autor}
            </h4>
            <p className="text-sm text-neutral-300 leading-relaxed font-medium line-clamp-4">
              “{observation.texto}”
            </p>
          </div>
        </div>
        <div>
          <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Produto</span>
          <p className="text-sm text-neutral-200 mt-1 font-medium bg-neutral-900 p-2.5 rounded-[var(--radius-md)] border border-white/[0.08]">
            {productName}
          </p>
        </div>
      </ModalBody>
      <ModalFooter className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
        {onEdit && (
          <Button onClick={onEdit}>
            Editar Nota
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
