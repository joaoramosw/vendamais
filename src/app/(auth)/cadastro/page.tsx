"use client"

import { CadastroForm } from "@/components/auth/CadastroForm"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

export default function CadastroPage() {
  return (
    <Suspense fallback={null}>
      <CadastroCard />
    </Suspense>
  )
}

/**
 * Cadastro geral de fornecedor — telefone + senha, sem e-mail em lugar nenhum.
 * O mesmo formulário aparece embutido no gate do link da proposta
 * (`/proposta/[id]`), pra quem chega pelo WhatsApp sem conta.
 */
function CadastroCard() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") ?? ""

  const loginHref = redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"

  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/[0.06] rounded-[var(--radius-xl)] shadow-xl p-8">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-1">Criar conta</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
        Leva menos de um minuto. Você entra pelo telefone — não pedimos e-mail.
      </p>

      <CadastroForm redirectTo={redirectTo} />

      <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Já tem conta?{" "}
        <Link
          href={loginHref}
          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
        >
          Entrar
        </Link>
      </p>
    </div>
  )
}
