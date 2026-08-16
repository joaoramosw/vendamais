"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { Select } from "@/components/ui/input";
import { useSegmentos } from "@/lib/hooks/useSegmentos";
import { buscarFornecedores, type FornecedorBusca } from "@/lib/api/cotacoes-api";
import { formatPhone, isValidBrPhone, looksLikePhone } from "@/lib/whatsapp";

const TODOS_SEGMENTOS = "__todos__";

interface FornecedorSelectorProps {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /**
   * Quando informado, digitar um telefone que não bate com nenhum fornecedor
   * cadastrado oferece convidar esse número direto por WhatsApp. Recebe o
   * número cru digitado; o chamador decide o que fazer (criar convite na hora
   * ou deixar pendente até a cotação existir).
   */
  onConvidarNumero?: (numero: string) => void;
  /** Números (só dígitos) já convidados/pendentes — some com a oferta acima. */
  numerosJaConvidados?: Set<string>;
}

/** Busca por nome/WhatsApp + filtro de segmento, com multisseleção —
 * reutilizado pelo modal de convite (cotação já existe) e pelo modal de
 * envio da lista de cotação (cotação ainda não existe, seleção é aplicada
 * depois que a cotação é publicada). */
export function FornecedorSelector({
  selected,
  onChange,
  onConvidarNumero,
  numerosJaConvidados,
}: FornecedorSelectorProps) {
  const [busca, setBusca] = useState("");
  const [segmentoId, setSegmentoId] = useState(TODOS_SEGMENTOS);
  const [fornecedores, setFornecedores] = useState<FornecedorBusca[]>([]);
  const [loading, setLoading] = useState(true);
  const { segmentos } = useSegmentos();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await buscarFornecedores(
          busca.trim() || undefined,
          segmentoId === TODOS_SEGMENTOS ? undefined : segmentoId,
        );
        if (!cancelled) setFornecedores(data);
      } catch {
        if (!cancelled) setFornecedores([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [busca, segmentoId]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  const allVisibleSelected =
    fornecedores.length > 0 && fornecedores.every((f) => selected.has(f.id));

  // "Esse número não está na cotação — quer mandar mensagem?": só quando o
  // termo digitado é um telefone, a busca já terminou sem nenhum fornecedor
  // cadastrado e esse número ainda não foi convidado.
  const numeroDigitado = looksLikePhone(busca) ? busca.trim() : null;
  const numeroDigits = numeroDigitado?.replace(/\D/g, "") ?? "";
  const ofereceConviteAvulso =
    !!onConvidarNumero &&
    !!numeroDigitado &&
    isValidBrPhone(numeroDigitado) &&
    !loading &&
    fornecedores.length === 0 &&
    !numerosJaConvidados?.has(numeroDigits);

  function handleConvidarNumero() {
    if (!numeroDigitado || !onConvidarNumero) return;
    onConvidarNumero(numeroDigitado);
    setBusca("");
  }

  function toggleAllVisible() {
    const next = new Set(selected);
    if (allVisibleSelected) {
      fornecedores.forEach((f) => next.delete(f.id));
    } else {
      fornecedores.forEach((f) => next.add(f.id));
    }
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou WhatsApp..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-neutral-500 outline-none focus:border-primary-500 transition-colors"
          />
        </div>
        <Select
          value={segmentoId}
          onChange={(e) => setSegmentoId(e.target.value)}
          options={[
            { value: TODOS_SEGMENTOS, label: "Todos os segmentos" },
            ...segmentos.map((s) => ({ value: s.id, label: s.nome })),
          ]}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{selected.size} selecionado(s)</span>
        {fornecedores.length > 0 && (
          <button
            type="button"
            onClick={toggleAllVisible}
            className="text-primary-400 hover:text-primary-300 transition-colors"
          >
            {allVisibleSelected ? "Desmarcar todos" : "Selecionar todos"}
          </button>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto space-y-1 border border-white/[0.06] rounded-lg p-1.5">
        {loading ? (
          <p className="text-xs text-neutral-500 text-center py-4">Buscando...</p>
        ) : fornecedores.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-4">
            {numeroDigitado
              ? "Nenhum fornecedor cadastrado com esse número."
              : "Nenhum fornecedor encontrado."}
          </p>
        ) : (
          fornecedores.map((f) => (
            <label
              key={f.id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/[0.04] cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                onChange={() => toggle(f.id)}
                className="h-4 w-4 rounded border-white/20 accent-primary-500 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-200 truncate">{f.nome}</p>
                <p className="text-xs text-neutral-500 truncate">
                  {f.whatsapp || f.email || "Sem contato cadastrado"}
                </p>
              </div>
            </label>
          ))
        )}
      </div>

      {ofereceConviteAvulso && (
        <button
          type="button"
          onClick={handleConvidarNumero}
          className="w-full flex items-start gap-2.5 text-left px-3 py-2.5 rounded-lg border border-success-500/30 bg-success-500/[0.07] hover:bg-success-500/[0.12] transition-colors cursor-pointer"
        >
          <MessageCircle className="h-4 w-4 text-success-400 shrink-0 mt-0.5" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-success-300">
              {formatPhone(numeroDigitado!)} não está na cotação
            </span>
            <span className="block text-xs text-neutral-400 mt-0.5">
              Deseja enviar uma mensagem? Convidamos esse número por WhatsApp.
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
