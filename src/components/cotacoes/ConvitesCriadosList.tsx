"use client";

import { toast } from "sonner";
import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import type { FornecedorConvidadoRow } from "@/lib/api/cotacoes-api";
import { propostaPath, propostaUrl } from "@/lib/routes";
import { buildConviteCotacaoMessage, formatPhone, shareViaWhatsApp } from "@/lib/whatsapp";

/** Link público do convite. Slug canônico em src/lib/routes.ts — não monte
 * `/proposta/...` à mão em lugar nenhum. */
export function conviteLink(token: string): string {
  return typeof window === "undefined" ? propostaPath(token) : propostaUrl(token);
}

export interface ConviteMensagemContexto {
  cotacaoTitulo: string;
  totalItens?: number;
  dataLimite?: string | null;
}

interface ConvitesCriadosListProps extends ConviteMensagemContexto {
  convites: FornecedorConvidadoRow[];
}

/** Lista de convites recém-criados com o disparo do WhatsApp por trás de um
 * clique do usuário — abrir a janela automaticamente depois do await costuma
 * ser barrado pelo bloqueador de pop-up do navegador. */
export function ConvitesCriadosList({
  convites,
  cotacaoTitulo,
  totalItens,
  dataLimite,
}: ConvitesCriadosListProps) {
  function abrirWhatsApp(convite: FornecedorConvidadoRow) {
    shareViaWhatsApp(
      buildConviteCotacaoMessage({
        fornecedorNome: convite.nome_empresa,
        cotacaoTitulo,
        link: conviteLink(convite.token_acesso),
        totalItens,
        dataLimite,
      }),
      convite.whatsapp,
    );
  }

  function copiarLink(convite: FornecedorConvidadoRow) {
    navigator.clipboard.writeText(conviteLink(convite.token_acesso));
    toast.success("Link do convite copiado!");
  }

  return (
    <div className="space-y-2">
      {convites.map((c) => {
        const contato = c.whatsapp ? formatPhone(c.whatsapp) : c.email_contato;
        return (
          <div
            key={c.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-neutral-200 truncate">
                {c.nome_empresa || contato || "Sem contato"}
              </span>
              {c.nome_empresa && contato && (
                <span className="block text-xs text-neutral-500 truncate">{contato}</span>
              )}
            </span>
            {c.whatsapp && (
              <Button type="button" size="sm" onClick={() => abrirWhatsApp(c)}>
                <MessageCircle className="h-3.5 w-3.5" />
                Enviar
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => copiarLink(c)}
              title="Copiar link do convite"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

interface ConvitesCriadosModalProps extends ConvitesCriadosListProps {
  open: boolean;
  onClose: () => void;
}

/** Passo pós-publicação: a cotação já está no ar e os convites existem —
 * falta só disparar cada mensagem, o que precisa partir de um clique. */
export function ConvitesCriadosModal({
  open,
  onClose,
  convites,
  cotacaoTitulo,
  totalItens,
  dataLimite,
}: ConvitesCriadosModalProps) {
  const comWhatsApp = convites.filter((c) => c.whatsapp).length;

  return (
    <Modal open={open} onClose={onClose} className="max-w-lg">
      <ModalHeader onClose={onClose}>Cotação publicada! 🎉</ModalHeader>
      <ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto">
        <p className="text-sm text-neutral-400">
          {comWhatsApp > 0
            ? `${comWhatsApp} convite(s) com WhatsApp foram criados. Toque em "Enviar" para abrir a conversa com a mensagem já pronta.`
            : "Os convites foram criados. Copie o link e envie ao fornecedor."}
        </p>
        <ConvitesCriadosList
          convites={convites}
          cotacaoTitulo={cotacaoTitulo}
          totalItens={totalItens}
          dataLimite={dataLimite}
        />
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>Concluir</Button>
      </ModalFooter>
    </Modal>
  );
}
