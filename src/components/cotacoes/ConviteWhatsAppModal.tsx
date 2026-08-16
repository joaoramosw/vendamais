"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { FornecedorSelector } from "@/components/cotacoes/FornecedorSelector";
import {
  ConvitesCriadosList,
  conviteLink,
} from "@/components/cotacoes/ConvitesCriadosList";
import {
  convidarFornecedor,
  convidarPorUsuarios,
  type FornecedorConvidadoRow,
} from "@/lib/api/cotacoes-api";
import { buildConviteCotacaoMessage, isValidBrPhone, shareViaWhatsApp } from "@/lib/whatsapp";

type Canal = "whatsapp" | "email";

// WhatsApp primeiro — é o canal padrão de contato com fornecedor no Brasil,
// e o único que abre a conversa já com a mensagem pronta.
const CANAL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
];

interface ConviteWhatsAppModalProps {
  open: boolean;
  cotacaoId: string;
  cotacaoTitulo: string;
  totalItens?: number;
  dataLimite?: string | null;
  onClose: () => void;
  onInvited: (created: FornecedorConvidadoRow[]) => void;
}

/** Modal de convite — o canal (WhatsApp/e-mail) troca o painel inteiro:
 * quem vai receber e como o convite é entregue. Em ambos dá pra escolher
 * fornecedores já cadastrados ou digitar um contato avulso (sem conta). */
export function ConviteWhatsAppModal({
  open,
  cotacaoId,
  cotacaoTitulo,
  totalItens,
  dataLimite,
  onClose,
  onInvited,
}: ConviteWhatsAppModalProps) {
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [emailAvulso, setEmailAvulso] = useState("");
  const [whatsappAvulso, setWhatsappAvulso] = useState("");
  const [nomeEmpresaAvulso, setNomeEmpresaAvulso] = useState("");
  const [enviandoAvulso, setEnviandoAvulso] = useState(false);
  // Convites criados enquanto o modal está aberto — ficam listados pra que o
  // disparo do WhatsApp seja um clique direto do usuário (janela aberta fora
  // de um gesto costuma ser bloqueada pelo navegador).
  const [criados, setCriados] = useState<FornecedorConvidadoRow[]>([]);

  const isWhatsApp = canal === "whatsapp";

  function handleClose() {
    if (enviando || enviandoAvulso) return;
    setSelected(new Set());
    setEmailAvulso("");
    setWhatsappAvulso("");
    setNomeEmpresaAvulso("");
    setCriados([]);
    onClose();
  }

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

  function registrarCriados(novos: FornecedorConvidadoRow[]) {
    setCriados((prev) => [...novos, ...prev]);
    onInvited(novos);
  }

  async function handleConvidar() {
    if (selected.size === 0) return;
    setEnviando(true);
    try {
      const created = await convidarPorUsuarios(cotacaoId, Array.from(selected));
      if (created.length === 0) {
        toast.info("Os fornecedores selecionados já haviam sido convidados.");
      } else {
        toast.success(`${created.length} convite(s) criado(s)!`);
        registrarCriados(created);
      }
      setSelected(new Set());
      // No canal WhatsApp o modal continua aberto: os convites recém-criados
      // aparecem abaixo com o botão de disparo por número.
      if (!isWhatsApp) onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao convidar fornecedores.");
    } finally {
      setEnviando(false);
    }
  }

  async function criarAvulso(contato: {
    emailContato?: string;
    whatsapp?: string;
    nomeEmpresa?: string;
  }): Promise<FornecedorConvidadoRow | null> {
    setEnviandoAvulso(true);
    try {
      const created = await convidarFornecedor(cotacaoId, contato);
      registrarCriados([created]);
      return created;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar convite.");
      return null;
    } finally {
      setEnviandoAvulso(false);
    }
  }

  async function handleConvidarWhatsAppAvulso(numero?: string) {
    const whatsapp = (numero ?? whatsappAvulso).trim();
    if (!whatsapp) return;
    if (!isValidBrPhone(whatsapp)) {
      toast.error("Informe um número válido com DDD (ex.: (11) 91234-5678).");
      return;
    }

    const created = await criarAvulso({
      whatsapp,
      nomeEmpresa: nomeEmpresaAvulso.trim() || undefined,
    });
    if (!created) return;

    setWhatsappAvulso("");
    setNomeEmpresaAvulso("");
    toast.success("Convite criado! Abrindo o WhatsApp...");
    abrirWhatsApp(created);
  }

  async function handleConvidarEmailAvulso() {
    const email = emailAvulso.trim();
    if (!email) return;

    const created = await criarAvulso({
      emailContato: email,
      nomeEmpresa: nomeEmpresaAvulso.trim() || undefined,
    });
    if (!created) return;

    setEmailAvulso("");
    setNomeEmpresaAvulso("");
    toast.success("Convite por e-mail criado! Copie o link e envie ao fornecedor.");
  }

  const numerosJaConvidados = new Set(
    criados.map((c) => (c.whatsapp ?? "").replace(/\D/g, "")).filter(Boolean),
  );

  return (
    <Modal open={open} onClose={handleClose} className="max-w-lg">
      <ModalHeader onClose={handleClose}>Convidar fornecedores</ModalHeader>
      <ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto">
        <Select
          label="Enviar convite por"
          value={canal}
          onChange={(e) => setCanal(e.target.value as Canal)}
          options={CANAL_OPTIONS}
        />

        <p className="text-xs text-neutral-500">
          {isWhatsApp
            ? "Escolha fornecedores cadastrados ou digite um número avulso. O convite abre o WhatsApp com a mensagem pronta e o link da cotação."
            : "Escolha fornecedores cadastrados ou digite um e-mail avulso. O convite gera um link que você copia e envia por e-mail."}
        </p>

        <FornecedorSelector
          selected={selected}
          onChange={setSelected}
          onConvidarNumero={isWhatsApp ? handleConvidarWhatsAppAvulso : undefined}
          numerosJaConvidados={numerosJaConvidados}
        />

        <div className="border-t border-white/[0.06] pt-4 space-y-3">
          <p className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
            {isWhatsApp ? (
              <MessageCircle className="h-3.5 w-3.5" />
            ) : (
              <Mail className="h-3.5 w-3.5" />
            )}
            {isWhatsApp
              ? "Ou convide um número avulso (sem conta cadastrada)"
              : "Ou convide um e-mail avulso (sem conta cadastrada)"}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isWhatsApp ? (
              <Input
                label="WhatsApp *"
                inputMode="tel"
                placeholder="(11) 91234-5678"
                value={whatsappAvulso}
                onChange={(e) => setWhatsappAvulso(e.target.value)}
              />
            ) : (
              <Input
                label="E-mail *"
                type="email"
                placeholder="fornecedor@exemplo.com"
                value={emailAvulso}
                onChange={(e) => setEmailAvulso(e.target.value)}
              />
            )}
            <Input
              label="Nome do fornecedor (opcional)"
              placeholder="Ex.: Distribuidora Central"
              value={nomeEmpresaAvulso}
              onChange={(e) => setNomeEmpresaAvulso(e.target.value)}
              helper={isWhatsApp ? "Abre a mensagem: “Olá, Distribuidora Central!”" : undefined}
            />
          </div>

          {isWhatsApp ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleConvidarWhatsAppAvulso()}
              loading={enviandoAvulso}
              disabled={enviandoAvulso || !whatsappAvulso.trim()}
            >
              <MessageCircle className="h-4 w-4" />
              Convidar e abrir WhatsApp
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleConvidarEmailAvulso}
              loading={enviandoAvulso}
              disabled={enviandoAvulso || !emailAvulso.trim()}
            >
              <Mail className="h-4 w-4" />
              Criar convite por e-mail
            </Button>
          )}
        </div>

        {criados.length > 0 && (
          <div className="border-t border-white/[0.06] pt-4 space-y-2">
            <p className="text-xs font-medium text-neutral-400">
              Convites criados agora ({criados.length})
            </p>
            <ConvitesCriadosList
              convites={criados}
              cotacaoTitulo={cotacaoTitulo}
              totalItens={totalItens}
              dataLimite={dataLimite}
            />
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose} disabled={enviando || enviandoAvulso}>
          Fechar
        </Button>
        <Button
          onClick={handleConvidar}
          loading={enviando}
          disabled={enviando || selected.size === 0}
        >
          <Users className="h-4 w-4" />
          Convidar{selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
