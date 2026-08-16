"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { exportarCotacao } from "@/lib/api/cotacoes-api";
import { cn } from "@/lib/utils";

type Formato = "xlsx" | "pdf";

interface ExportarCotacaoModalProps {
  open: boolean;
  cotacaoId: string;
  onClose: () => void;
}

export function ExportarCotacaoModal({ open, cotacaoId, onClose }: ExportarCotacaoModalProps) {
  const [formato, setFormato] = useState<Formato>("xlsx");
  const [incluirInternos, setIncluirInternos] = useState(true);
  const [exportando, setExportando] = useState(false);

  async function handleExportar() {
    setExportando(true);
    try {
      await exportarCotacao(cotacaoId, formato, incluirInternos);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao exportar cotação.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader onClose={onClose}>Exportar cotação</ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Escolha o formato do arquivo</p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setFormato("xlsx")}
            className={cn(
              "w-full flex items-center gap-3 text-left px-4 py-3 rounded-[var(--radius-md)] border transition-all cursor-pointer",
              formato === "xlsx"
                ? "border-primary-500 bg-primary-500/5"
                : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600",
            )}
          >
            <FileSpreadsheet className="h-5 w-5 text-success-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                Excel (.xlsx)
              </p>
              <p className="text-xs text-neutral-500">Editável, com todas as colunas</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFormato("pdf")}
            className={cn(
              "w-full flex items-center gap-3 text-left px-4 py-3 rounded-[var(--radius-md)] border transition-all cursor-pointer",
              formato === "pdf"
                ? "border-primary-500 bg-primary-500/5"
                : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600",
            )}
          >
            <FileText className="h-5 w-5 text-danger-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">PDF</p>
              <p className="text-xs text-neutral-500">Relatório pronto para impressão</p>
            </div>
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 cursor-pointer select-none pt-2 border-t border-neutral-100 dark:border-white/[0.06]">
          <input
            type="checkbox"
            checked={incluirInternos}
            onChange={(e) => setIncluirInternos(e.target.checked)}
            className="rounded border-white/20 bg-white/[0.05]"
          />
          Incluir colunas internas (estoque e sugestão)
        </label>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={exportando}>
          Cancelar
        </Button>
        <Button onClick={handleExportar} loading={exportando} disabled={exportando}>
          Exportar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
