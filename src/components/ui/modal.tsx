"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ─── Modal Overlay ─── */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

const FIELD_SELECTOR =
  "input:not([disabled]):not([type=hidden]), textarea:not([disabled]), select:not([disabled])";

export function Modal({ open, onClose, children, className }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // `onClose` costuma ser uma arrow inline no chamador, ou seja, muda de
  // identidade a cada render do pai. Guardá-la num ref mantém `handleKeyDown`
  // — e portanto o efeito de foco abaixo — estável: sem isso, cada tecla
  // digitada num campo do modal re-disparava o efeito, o cleanup devolvia o
  // foco pra fora e o rAF o jogava no primeiro elemento focável. Era o
  // "some o foco a cada caractere" do modal de Enviar Cotação.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab" || !contentRef.current) return;

      const focusable = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    []
  );

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";

      // Aguarda o conteúdo montar antes de mover o foco pra dentro do modal.
      const raf = requestAnimationFrame(() => {
        const content = contentRef.current;
        if (!content) return;
        // Respeita quem já ganhou o foco por conta própria (autoFocus).
        if (content.contains(document.activeElement)) return;
        // Prefere o primeiro campo preenchível ao botão de fechar do header,
        // que é o primeiro elemento focável na ordem do DOM.
        const target =
          content.querySelector<HTMLElement>(FIELD_SELECTOR) ??
          content.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
          content;
        target.focus();
      });

      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
        previouslyFocusedRef.current?.focus();
      };
    }
    return undefined;
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Content */}
      <div
        ref={contentRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-lg bg-white dark:bg-neutral-800 rounded-[var(--radius-xl)] shadow-xl dark:shadow-2xl dark:shadow-black/30 animate-scale-in border border-transparent dark:border-neutral-700 focus:outline-none",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── Modal Header ─── */
interface ModalHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function ModalHeader({ children, onClose, className }: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-700",
        className
      )}
    >
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{children}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1.5 rounded-[var(--radius-md)] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/* ─── Modal Body ─── */
export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

/* ─── Modal Footer ─── */
export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-100 dark:border-neutral-700",
        className
      )}
    >
      {children}
    </div>
  );
}
