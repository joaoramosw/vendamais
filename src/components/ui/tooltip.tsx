"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  /** Texto curto — o que o controle faz. */
  label: React.ReactNode;
  children: React.ReactNode;
  /** Classe do wrapper (ele é um `span` inline-flex em volta do filho). */
  className?: string;
  /** Acima por padrão; "bottom" para alvo no topo da tela, "right" para
   * coluna estreita onde o balão não cabe acima/abaixo (ex.: sidebar recolhida). */
  side?: "top" | "bottom" | "right";
  /**
   * Balão explicativo (algumas linhas) em vez de rótulo de uma linha só.
   * O padrão é `whitespace-nowrap` porque a esmagadora maioria dos usos é
   * "o que este botão faz"; texto de explicação nesse modo viraria uma linha
   * larguíssima que estoura a viewport.
   */
  wide?: boolean;
}

interface Pos {
  top: number;
  left: number;
}

const GAP = 8;
/** Largura máxima do balão explicativo (`wide`), em px. */
const WIDE_MAX_WIDTH = 260;

/**
 * Tooltip leve, renderizado em portal no `body`.
 *
 * O portal não é preciosismo: a tabela de produtos rola dentro de um container
 * com `overflow-x-auto`, e um balão posicionado dentro dela seria recortado
 * nas primeiras e últimas linhas. Posiciona por `getBoundingClientRect` e
 * some ao rolar, já que a posição é fixa na viewport.
 */
export function Tooltip({ label, children, className, side = "top", wide }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  const show = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (side === "right") {
      setPos({ top: rect.top + rect.height / 2, left: rect.right + GAP });
      return;
    }

    // Metade da largura máxima do balão — é o quanto ele pode transbordar
    // pra cada lado do ponto de ancoragem (`-translate-x-1/2`).
    const meiaLargura = wide ? WIDE_MAX_WIDTH / 2 : 80;
    setPos({
      top: side === "top" ? rect.top - GAP : rect.bottom + GAP,
      // Mantém o balão dentro da viewport em telas estreitas.
      left: Math.min(
        Math.max(rect.left + rect.width / 2, meiaLargura),
        window.innerWidth - meiaLargura,
      ),
    });
  }, [side, wide]);

  const hide = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [pos, hide]);

  return (
    <>
      <span
        ref={anchorRef}
        className={cn("inline-flex", className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>

      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: pos.top, left: pos.left, maxWidth: wide ? WIDE_MAX_WIDTH : undefined }}
            className={cn(
              "pointer-events-none fixed z-[60]",
              side === "right" ? "-translate-y-1/2" : "-translate-x-1/2",
              "rounded-md bg-neutral-900 dark:bg-neutral-700 px-2 py-1 text-[11px] font-medium text-white",
              "shadow-lg shadow-black/30 animate-fade-in",
              wide ? "block whitespace-normal text-left leading-snug" : "whitespace-nowrap",
              side === "top" ? "-translate-y-full" : "",
            )}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
