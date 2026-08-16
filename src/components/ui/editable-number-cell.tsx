"use client";

import { useCallback, useRef, useState } from "react";

/** Direção pedida ao pai quando o usuário aperta Tab/Enter dentro da célula. */
export type NavegacaoCelula = "proximo" | "anterior";

interface EditableNumberCellProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  zeroLabel?: string;
  title?: string;
  /**
   * Marca o elemento focável da célula (`data-foco`), para que o pai consiga
   * mover o foco entre células com `querySelector` sem montar um registro de
   * refs. Usado pela lista de cotação (Estoque → Sugestão → próxima linha).
   */
  focusKey?: string;
  /**
   * Entra em edição já ao **receber foco**, não só no clique — sem isso, um
   * Tab que cai nesta célula pararia no botão e exigiria um Enter extra antes
   * de digitar.
   */
  editOnFocus?: boolean;
  /**
   * Chamado quando o usuário aperta Tab/Enter dentro do campo. Deve devolver
   * `true` se moveu o foco: só nesse caso o comportamento nativo do Tab é
   * cancelado (no último campo da tabela o Tab tem que seguir seu curso).
   */
  onNavigate?: (direcao: NavegacaoCelula) => boolean;
}

/** Célula numérica com clique-para-editar + commit no blur/Enter — extraído
 * do padrão original de EditableSugerido (DraftListClient.tsx), reutilizado
 * também nos campos Sugestão/Preço unit. das telas de cotação. */
export function EditableNumberCell({
  value,
  onChange,
  min = 1,
  zeroLabel = "—",
  title,
  focusKey,
  editOnFocus = false,
  onNavigate,
}: EditableNumberCellProps) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    setLocalVal(value === 0 ? "" : String(value));
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [value]);

  const commit = () => {
    const parsed = parseInt(localVal, 10);
    const normalized = Number.isFinite(parsed) && parsed >= min ? parsed : min;
    setLocalVal(String(normalized));
    setEditing(false);
    if (normalized !== value) onChange(normalized);
  };

  /** Tab/Enter: grava o que foi digitado **antes** de sair, senão o valor se
   * perde ao desmontar o input. */
  function handleNavegacao(e: React.KeyboardEvent, direcao: NavegacaoCelula) {
    const movido = onNavigate?.(direcao) ?? false;
    if (movido) e.preventDefault();
    commit();
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-foco={focusKey}
        type="number"
        min={min}
        step="1"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") {
            handleNavegacao(e, e.shiftKey ? "anterior" : "proximo");
            return;
          }
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-20 bg-neutral-900 border border-primary-500/40 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-center text-neutral-200 outline-none ring-2 ring-primary-500/20 transition-all"
      />
    );
  }

  if (value === 0) {
    return (
      <button
        type="button"
        data-foco={focusKey}
        onClick={startEditing}
        onFocus={editOnFocus ? startEditing : undefined}
        className="w-20 text-center py-1.5 px-2.5 rounded-[var(--radius-md)] text-sm font-medium text-warning-400/80 bg-warning-500/5 border border-warning-500/10 hover:border-warning-500/30 hover:bg-warning-500/10 transition-all cursor-pointer"
        title={title ?? "Clique para preencher"}
      >
        ({zeroLabel})
      </button>
    );
  }

  return (
    <button
      type="button"
      data-foco={focusKey}
      onClick={startEditing}
      onFocus={editOnFocus ? startEditing : undefined}
      className="w-20 bg-neutral-900 border border-white/[0.08] rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-center text-neutral-200 hover:border-primary-500/30 transition-all cursor-pointer"
      title={title ?? "Clique para editar"}
    >
      {value}
    </button>
  );
}
