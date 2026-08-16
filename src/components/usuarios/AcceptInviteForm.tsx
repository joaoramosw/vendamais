'use client'

import { acceptManagedInvitation } from '@/actions/invitation-accept'
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy'
import { maskPhoneInput } from '@/lib/phone'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface AcceptInviteFormProps {
  token: string
}

/**
 * Conclusão do cadastro a partir de um convite por link (fluxo legado — ver
 * `acceptManagedInvitation`). Não mostra e-mail: quem entra na plataforma
 * entra pelo **telefone**, então é ele que a pessoa define aqui.
 */
export function AcceptInviteForm({ token }: AcceptInviteFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: '',
    username: '',
    telefone: '',
    password: '',
    passwordConfirm: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.name === 'telefone' ? maskPhoneInput(e.target.value) : e.target.value
    setForm(prev => ({ ...prev, [e.target.name]: valor }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password.length < MIN_PASSWORD_LENGTH) {
      return setError(`A senha deve ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.`)
    }
    if (form.password !== form.passwordConfirm) {
      return setError('As senhas não coincidem.')
    }

    startTransition(async () => {
      const res = await acceptManagedInvitation({
        token,
        nome: form.nome,
        username: form.username,
        telefone: form.telefone,
        password: form.password,
      })

      if (res.error) {
        setError(res.error)
      } else {
        // Redireciona para login limpo — o usuário precisará fazer login com as novas credenciais
        router.push('/login?msg=conta-criada')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Telefone *</label>
        <input
          type="tel"
          inputMode="numeric"
          name="telefone"
          required
          value={form.telefone}
          onChange={handleChange}
          placeholder="(71) 99999-9999"
          className="w-full text-sm bg-white/[0.05] border border-white/[0.1] text-neutral-200 placeholder-neutral-600 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500/50 transition-shadow"
        />
        <p className="mt-1.5 text-[11px] text-neutral-500">É com ele que você vai entrar.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Seu nome completo *</label>
        <input
          type="text"
          name="nome"
          required
          value={form.nome}
          onChange={handleChange}
          placeholder="Ex: João Silva"
          className="w-full text-sm bg-white/[0.05] border border-white/[0.1] text-neutral-200 placeholder-neutral-600 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500/50 transition-shadow"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Nome de usuário (único) *</label>
        <input
          type="text"
          name="username"
          required
          pattern="[a-zA-Z0-9_]+"
          title="Apenas letras, números e underline"
          value={form.username}
          onChange={handleChange}
          placeholder="Ex: joaosilva"
          className="w-full text-sm bg-white/[0.05] border border-white/[0.1] text-neutral-200 placeholder-neutral-600 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500/50 transition-shadow"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Senha *</label>
          <input
            type="password"
            name="password"
            required
            value={form.password}
            onChange={handleChange}
            placeholder={`Minimo ${MIN_PASSWORD_LENGTH} chars`}
            className="w-full text-sm bg-white/[0.05] border border-white/[0.1] text-neutral-200 placeholder-neutral-600 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500/50 transition-shadow"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Confirme a senha *</label>
          <input
            type="password"
            name="passwordConfirm"
            required
            value={form.passwordConfirm}
            onChange={handleChange}
            placeholder="Repita a senha"
            className="w-full text-sm bg-white/[0.05] border border-white/[0.1] text-neutral-200 placeholder-neutral-600 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500/50 transition-shadow"
          />
        </div>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 text-xs px-3 py-2.5 rounded-lg text-center">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors shadow-lg shadow-primary-500/20 disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Criando conta...
          </>
        ) : (
          <>
            Concluir cadastro
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  )
}
