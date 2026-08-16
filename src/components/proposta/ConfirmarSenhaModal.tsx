"use client";

/**
 * Confirmação por senha — última etapa antes de gravar a proposta.
 *
 * Reautentica o usuário logado (`confirmarSenha` → `verifyCurrentUserPassword`,
 * que valida num client isolado e **não** mexe na sessão atual). Senha errada
 * não envia nada e não desloga ninguém: é só uma mensagem no próprio modal.
 *
 * O objetivo é o mesmo de qualquer "digite sua senha para confirmar": preço é
 * compromisso comercial, e o aparelho fica destravado na mão do vendedor
 * enquanto ele preenche a cotação.
 */

import { confirmarSenha } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { formatPhoneBR } from "@/lib/phone";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";

interface ConfirmarSenhaModalProps {
  open: boolean;
  onClose: () => void;
  /** Chamado só depois da senha ser aceita. */
  onConfirmado: () => void;
  /** Telefone da conta, só pra deixar claro *qual* senha está sendo pedida. */
  telefone?: string | null;
  /** Envio em andamento (o pai continua ocupado depois do OK da senha). */
  enviando?: boolean;
}

export function ConfirmarSenhaModal({
  open,
  onClose,
  onConfirmado,
  telefone,
  enviando = false,
}: ConfirmarSenhaModalProps) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  // Cada abertura começa limpa — senha digitada não sobrevive ao fechamento.
  useEffect(() => {
    if (!open) {
      setSenha("");
      setErro(null);
      setVerificando(false);
    }
  }, [open]);

  const ocupado = verificando || enviando;

  async function handleConfirmar() {
    if (ocupado) return;
    setErro(null);

    if (!senha) {
      setErro("Informe sua senha para confirmar.");
      return;
    }

    setVerificando(true);
    const resultado = await confirmarSenha(senha);
    setVerificando(false);

    if (!resultado.ok) {
      setErro(resultado.error ?? "Senha incorreta. Tente novamente.");
      return;
    }

    onConfirmado();
  }

  return (
    <Modal open={open} onClose={() => !ocupado && onClose()} className="max-w-sm">
      <ModalHeader onClose={() => !ocupado && onClose()}>Confirme sua senha</ModalHeader>
      <ModalBody className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
            <Lock className="h-4 w-4 text-primary-500 dark:text-primary-400" />
          </span>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Para enviar a proposta, digite a senha da sua conta
            {telefone ? (
              <>
                {" "}
                <span className="font-medium text-neutral-800 dark:text-neutral-100">
                  {formatPhoneBR(telefone)}
                </span>
              </>
            ) : null}
            .
          </p>
        </div>

        <div>
          <label
            htmlFor="confirmar-senha"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
          >
            Senha
          </label>
          <input
            id="confirmar-senha"
            type="password"
            autoComplete="current-password"
            value={senha}
            disabled={ocupado}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleConfirmar();
              }
            }}
            placeholder="••••••••"
            aria-invalid={Boolean(erro)}
            className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all disabled:opacity-50"
          />
          {erro && (
            <p className="mt-1.5 text-xs text-danger-600 dark:text-danger-400" role="alert">
              {erro}
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={ocupado}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirmar}
          loading={ocupado}
          loadingText={enviando ? "Enviando..." : "Verificando..."}
        >
          Confirmar e enviar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
