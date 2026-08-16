"use client"

import { LoginForm } from "@/components/auth/LoginForm"
import { waMeUrl } from "@/lib/whatsapp"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginCard />
    </Suspense>
  )
}

function LoginCard() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") ?? ""

  const forgotPasswordLink = waMeUrl(
    "Olá! Preciso de ajuda para redefinir minha senha da plataforma VendaMais."
  )

  const cadastroHref = redirectTo
    ? `/cadastro?redirect=${encodeURIComponent(redirectTo)}`
    : "/cadastro"

  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/[0.06] rounded-[var(--radius-xl)] shadow-xl p-8">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-1">
        Entrar na plataforma
      </h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
        Use o seu telefone e a sua senha.
      </p>

      <LoginForm redirectTo={redirectTo} />

      <div className="mt-6 text-center space-y-2">
        <a
          href={forgotPasswordLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        >
          Esqueci minha senha
        </a>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Não tem conta?{" "}
          <Link
            href={cadastroHref}
            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
