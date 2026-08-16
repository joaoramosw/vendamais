import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalHeader } from "@/components/ui/modal";
import { DraftObservation } from "@/lib/hooks/useDraftList";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CheckCircle2, MessageSquarePlus, Trash2 } from "lucide-react";
import { useState } from "react";

interface ObservationHistoryModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  observacoes: DraftObservation[];
  onAddNote: (texto: string) => void;
  onResolveNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
}

const MAX_CHARS = 200;

export function ObservationHistoryModal({
  open,
  onClose,
  productName,
  observacoes,
  onAddNote,
  onResolveNote,
  onDeleteNote,
}: ObservationHistoryModalProps) {
  const [newNoteText, setNewNoteText] = useState("");

  const charsLeft = MAX_CHARS - newNoteText.length;
  const isOverLimit = charsLeft < 0;
  const isEmpty = newNoteText.trim().length === 0;

  const handleSend = () => {
    if (isEmpty || isOverLimit) return;
    onAddNote(newNoteText.trim());
    setNewNoteText("");
  };

  const hasNotes = observacoes && observacoes.length > 0;

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <ModalHeader onClose={onClose}>Observações do Produto</ModalHeader>
      <ModalBody className="space-y-4 max-h-[70vh] flex flex-col">
        <div>
          <p className="text-sm text-neutral-200 font-medium bg-neutral-900 p-2.5 rounded-[var(--radius-md)] border border-white/[0.08] truncate">
            {productName}
          </p>
        </div>

        {/* Histórico Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
          {!hasNotes ? (
            <div className="text-center py-6 text-neutral-500 text-sm italic">
              Nenhuma anotação para este produto ainda.
            </div>
          ) : (
            observacoes.map((obs) => (
              <div
                key={obs.id}
                className={`flex items-start gap-3 p-3 border rounded-[var(--radius-md)] transition-colors ${
                  obs.resolvida
                    ? "bg-white/[0.02] border-white/[0.05] opacity-60 grayscale"
                    : "bg-yellow-500/10 border-yellow-500/20"
                }`}
              >
                <div
                  className={`p-1.5 rounded-full shrink-0 mt-0.5 ${
                    obs.resolvida ? "bg-neutral-700 text-neutral-400" : "bg-yellow-500 text-yellow-950"
                  }`}
                >
                  {obs.resolvida ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                </div>
                <div className="space-y-1 w-full min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-xs font-semibold truncate ${obs.resolvida ? "text-neutral-400" : "text-yellow-500"}`}>
                      {obs.autor}
                    </h4>
                    <span className="text-[10px] text-neutral-500 shrink-0">
                      {format(new Date(obs.dataCriacao), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-300 leading-relaxed font-medium break-words">
                    {obs.texto}
                  </p>
                  
                  {/* Actions for this note */}
                  <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-white/[0.05]">
                    {!obs.resolvida && (
                      <button
                        onClick={() => onResolveNote(obs.id)}
                        className="text-xs text-success-400/70 hover:text-success-400 font-medium transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Resolver
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteNote(obs.id)}
                      className="text-xs text-danger-400/70 hover:text-danger-400 font-medium transition-colors flex items-center gap-1 ml-2"
                    >
                      <Trash2 className="h-3 w-3" /> Apagar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="pt-3 border-t border-white/[0.08] space-y-2 mt-auto">
          <div className="relative">
            <textarea
              placeholder="Adicionar um novo comentário..."
              value={newNoteText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewNoteText(e.target.value)}
              className={`w-full bg-neutral-900 border rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-neutral-200 outline-none transition-all resize-none h-20 placeholder:text-neutral-600 ${
                isOverLimit ? "border-danger-500/50 focus:ring-2 focus:ring-danger-500/20" : "border-white/[0.08] focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              }`}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              <span className={`text-[10px] font-medium ${isOverLimit ? "text-danger-400" : "text-neutral-500"}`}>
                {newNoteText.length}/{MAX_CHARS}
              </span>
              <Button
                size="sm"
                className="h-7 px-2"
                onClick={handleSend}
                disabled={isEmpty || isOverLimit}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
