"use client";

/**
 * AgruparCotacoesModal — destino do "Agrupar" da seleção múltipla em
 * /empresario/cotacoes.
 *
 * As três opções (grupo existente, grupo novo, tirar do grupo) vivem numa
 * lista de rádio só porque são mutuamente exclusivas: mover para um grupo já
 * é, na prática, tirar do anterior.
 */

import { useEffect, useState } from "react";
import { Folder, FolderPlus, FolderMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { CotacaoGrupo } from "@/lib/api/cotacoes-api";

export type DestinoGrupo =
  | { tipo: "existente"; grupoId: string }
  | { tipo: "novo"; nome: string }
  | { tipo: "remover" };

const NOVO = "__novo__";
const REMOVER = "__remover__";

interface AgruparCotacoesModalProps {
  open: boolean;
  onClose: () => void;
  grupos: CotacaoGrupo[];
  /** Quantas cotações serão movidas — some no texto do botão. */
  quantidade: number;
  salvando: boolean;
  onConfirmar: (destino: DestinoGrupo) => void;
}

export function AgruparCotacoesModal({
  open,
  onClose,
  grupos,
  quantidade,
  salvando,
  onConfirmar,
}: AgruparCotacoesModalProps) {
  const [escolha, setEscolha] = useState<string>(NOVO);
  const [nomeNovo, setNomeNovo] = useState("");

  // Reabrir o modal recomeça do zero — sem isso, o nome digitado numa
  // tentativa anterior reaparece como se fosse sugestão.
  useEffect(() => {
    if (!open) return;
    setEscolha(grupos.length > 0 ? grupos[0].id : NOVO);
    setNomeNovo("");
  }, [open, grupos]);

  if (!open) return null;

  const nomeValido = nomeNovo.trim().length > 0;
  const podeConfirmar = escolha === NOVO ? nomeValido : true;

  function confirmar() {
    if (escolha === NOVO) {
      if (!nomeValido) return;
      onConfirmar({ tipo: "novo", nome: nomeNovo.trim() });
    } else if (escolha === REMOVER) {
      onConfirmar({ tipo: "remover" });
    } else {
      onConfirmar({ tipo: "existente", grupoId: escolha });
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader onClose={onClose}>Agrupar cotações</ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {quantidade} {quantidade === 1 ? "cotação selecionada" : "cotações selecionadas"}. Escolha
          o destino:
        </p>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {grupos.map((grupo) => (
            <OpcaoGrupo
              key={grupo.id}
              ativo={escolha === grupo.id}
              onSelect={() => setEscolha(grupo.id)}
              icon={<Folder className="h-4 w-4" />}
              label={grupo.nome}
            />
          ))}

          <OpcaoGrupo
            ativo={escolha === NOVO}
            onSelect={() => setEscolha(NOVO)}
            icon={<FolderPlus className="h-4 w-4" />}
            label="Criar um grupo novo"
          />

          <OpcaoGrupo
            ativo={escolha === REMOVER}
            onSelect={() => setEscolha(REMOVER)}
            icon={<FolderMinus className="h-4 w-4" />}
            label="Tirar do grupo"
          />
        </div>

        {escolha === NOVO && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="nome-grupo-novo"
              className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Nome do grupo
            </label>
            <input
              id="nome-grupo-novo"
              autoFocus
              value={nomeNovo}
              maxLength={60}
              onChange={(e) => setNomeNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && podeConfirmar && !salvando) confirmar();
              }}
              placeholder="Ex.: Compras de setembro"
              className="w-full border rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border-neutral-200 dark:border-white/10 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Se já existir um grupo com esse nome, as cotações vão para ele.
            </p>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={salvando}>
          Cancelar
        </Button>
        <Button onClick={confirmar} disabled={!podeConfirmar || salvando} loading={salvando}>
          Mover {quantidade}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function OpcaoGrupo({
  ativo,
  onSelect,
  icon,
  label,
}: {
  ativo: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={ativo}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] text-sm text-left cursor-pointer transition-colors border",
        ativo
          ? "bg-primary-500/10 border-primary-500/40 text-primary-700 dark:text-primary-300"
          : "border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.04]",
      )}
    >
      <span className={ativo ? "text-primary-500" : "text-neutral-400"}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
