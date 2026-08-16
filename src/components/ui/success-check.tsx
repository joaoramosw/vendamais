"use client";

/**
 * Check de confirmação — o "parabéns, deu certo" do envio da proposta.
 *
 * Três camadas que entram em sequência: o disco (mola, dá o peso), o traço do
 * check (desenhado, não aparece pronto) e um halo que expande e some. As
 * partículas em volta são o exagero proposital do momento — é o único lugar do
 * app com esse tipo de celebração, e é o fim de um fluxo longo de digitar
 * preço item por item.
 *
 * `useReducedMotion` desliga tudo e entrega o ícone estático: quem pediu menos
 * movimento no sistema recebe a mesma informação, sem a animação.
 */

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SuccessCheckProps {
  size?: number;
  className?: string;
}

const PARTICULAS = [0, 45, 90, 135, 180, 225, 270, 315];

export function SuccessCheck({ size = 96, className }: SuccessCheckProps) {
  const semMovimento = useReducedMotion();

  if (semMovimento) {
    return (
      <div
        className={cn("relative flex items-center justify-center", className)}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
          <circle cx="50" cy="50" r="34" className="fill-success-500/15" />
          <path
            d="M34 51.5 L45 62 L67 39"
            fill="none"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-success-500"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Halo — expande e some uma vez só, marcando o instante do envio. */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-success-500/30"
        initial={{ scale: 0.6, opacity: 0.8 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />

      {PARTICULAS.map((angulo, i) => (
        <motion.span
          key={angulo}
          aria-hidden="true"
          className="absolute h-1.5 w-1.5 rounded-full bg-success-400"
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
          animate={{
            x: Math.cos((angulo * Math.PI) / 180) * (size * 0.62),
            y: Math.sin((angulo * Math.PI) / 180) * (size * 0.62),
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.4],
          }}
          transition={{ duration: 0.75, delay: 0.18 + i * 0.015, ease: "easeOut" }}
        />
      ))}

      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="relative"
        role="img"
        aria-label="Proposta enviada com sucesso"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
      >
        <circle cx="50" cy="50" r="34" className="fill-success-500/15" />
        <motion.circle
          cx="50"
          cy="50"
          r="34"
          fill="none"
          strokeWidth={4}
          className="stroke-success-500/50"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{ rotate: -90, transformOrigin: "50px 50px" }}
        />
        <motion.path
          d="M34 51.5 L45 62 L67 39"
          fill="none"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-success-500"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.28, ease: "easeOut" }}
        />
      </motion.svg>
    </div>
  );
}
