"use client";

import {
  getFornecedoresPorSegmento,
  type FornecedorDoSegmento,
} from "@/actions/fornecedor-segmentos";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";
import { formatPhone, shareViaWhatsApp } from "@/lib/whatsapp";
import { ExternalLink, Loader2, MessageCircle, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/** Teto de itens trazidos de uma vez — o modal é um resumo, não a listagem. */
const LIMITE = 60;

interface SegmentoFornecedoresModalProps {
  /** Segmento aberto; `null` mantém o modal fechado. */
  segmento: { id: string; nome: string; cor: string | null } | null;
  onClose: () => void;
}

/** Iniciais para o avatar — mesma linguagem do avatar do rodapé da sidebar. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

export function SegmentoFornecedoresModal({
  segmento,
  onClose,
}: SegmentoFornecedoresModalProps) {
  const [fornecedores, setFornecedores] = useState<FornecedorDoSegmento[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const segmentoId = segmento?.id ?? null;

  useEffect(() => {
    if (!segmentoId) return;
    let cancelado = false;

    setLoading(true);
    setError(null);
    setBusca("");

    getFornecedoresPorSegmento(segmentoId, LIMITE)
      .then((res) => {
        if (cancelado) return;
        if (res.error) {
          setError(res.error);
          return;
        }
        setFornecedores(res.fornecedores);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelado) setError("Não foi possível carregar os fornecedores deste segmento.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [segmentoId]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return fornecedores;
    return fornecedores.filter(
      (f) =>
        f.nome.toLowerCase().includes(termo) ||
        f.email.toLowerCase().includes(termo) ||
        (f.organization_name ?? "").toLowerCase().includes(termo) ||
        (f.whatsapp ?? "").includes(termo),
    );
  }, [fornecedores, busca]);

  if (!segmento) return null;

  const naoCarregados = total - fornecedores.length;

  return (
    <Modal open onClose={onClose} className="max-w-2xl">
      <ModalHeader onClose={onClose}>
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: segmento.cor || "#6366f1" }}
          />
          Fornecedores em {segmento.nome}
        </span>
      </ModalHeader>

      <ModalBody className="space-y-3 max-h-[65vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
            Carregando fornecedores...
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-danger-400">{error}</p>
        ) : fornecedores.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="h-7 w-7 text-neutral-500 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">
              Nenhum fornecedor classificado neste segmento ainda.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-500">
                {total} {total === 1 ? "fornecedor" : "fornecedores"}
                {naoCarregados > 0 && ` · mostrando os ${fornecedores.length} primeiros`}
              </p>
              {fornecedores.length > 8 && (
                <div className="relative w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Filtrar..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="w-full h-8 pl-8 pr-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/[0.08] rounded-[var(--radius-md)] text-xs text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-500 outline-none focus:border-primary-400 transition-colors"
                  />
                </div>
              )}
            </div>

            {visiveis.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">
                Nenhum fornecedor encontrado para “{busca.trim()}”.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {visiveis.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-2 rounded-[var(--radius-md)] border border-neutral-200 dark:border-white/[0.06] hover:border-primary-500/40 hover:bg-primary-500/[0.04] transition-colors"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: segmento.cor || "#6366f1" }}
                    >
                      {iniciais(f.organization_name || f.nome)}
                    </span>

                    <Link href={`/empresario/usuarios/${f.id}/editar`} className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-800 dark:text-neutral-200 truncate">
                        {f.organization_name || f.nome}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">
                        {f.whatsapp ? formatPhone(f.whatsapp) : f.email}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">
                        Desde {formatDate(f.created_at)}
                      </p>
                    </Link>

                    {f.whatsapp && (
                      <button
                        type="button"
                        onClick={() =>
                          shareViaWhatsApp(
                            `Olá, ${f.organization_name || f.nome}!`,
                            f.whatsapp,
                          )
                        }
                        title={`Falar com ${f.organization_name || f.nome} no WhatsApp`}
                        aria-label={`Falar com ${f.organization_name || f.nome} no WhatsApp`}
                        className="shrink-0 p-1.5 rounded-[var(--radius-md)] text-success-500 hover:bg-success-500/10 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </ModalBody>

      <ModalFooter className="justify-between">
        <Link href="/empresario/usuarios">
          <Button variant="ghost" size="sm" type="button">
            <ExternalLink className="h-4 w-4" />
            Ver na gestão de usuários
          </Button>
        </Link>
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
