"use client"

import { updatePasswordAndClearMustChangeFlag } from "@/actions/auth"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy"
import { useState } from "react"

export default function TrocarSenhaPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.")
      return
    }

    setLoading(true)
    const result = await updatePasswordAndClearMustChangeFlag(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success the action redirects — no further state update needed.
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-4 text-white">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center text-center mb-8">
          {/* Fundo escuro fixo nesta tela, independente do tema global —
              `scheme="dark"` força o lockup de texto branco. */}
          <Logo variant="full" scheme="dark" size="xl" priority />
          <p className="text-neutral-400 text-sm mt-3">Cotação inteligente para redes de mercados</p>
        </div>

        <div className="bg-neutral-800 border border-white/[0.06] rounded-[var(--radius-xl)] shadow-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-2">Defina sua senha</h2>
          <p className="text-sm text-neutral-400 mb-6">
            Sua conta foi criada com uma senha provisória. Defina uma nova senha para continuar.
          </p>

          {error && (
            <div className="bg-danger-light text-danger text-sm rounded-[var(--radius-md)] p-3 mb-4 border border-danger-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-300 mb-1">
                Nova senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="w-full px-3 py-2.5 bg-neutral-900 border border-white/10 rounded-[var(--radius-md)] text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-300 mb-1">
                Confirme a nova senha
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="w-full px-3 py-2.5 bg-neutral-900 border border-white/10 rounded-[var(--radius-md)] text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                placeholder="Repita a senha"
              />
            </div>

            <Button type="submit" loading={loading} loadingText="Salvando..." className="w-full">
              Salvar senha e continuar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
