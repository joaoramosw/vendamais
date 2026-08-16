'use client'

import { updateUserInfo } from '@/actions/admin-users'
import { formatPhoneBR } from '@/lib/phone'
import type { RoleKey } from '@/lib/types/database'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { UserForm } from './UserForm'

interface EditUserClientProps {
  user: {
    id: string
    nome: string
    /** Telefone de login (`users.whatsapp`) — pode ser nulo em conta legada. */
    whatsapp: string | null
    organization_name: string | null
  }
}

export function EditUserClient({ user }: EditUserClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    nome: user.nome,
    telefone: formatPhoneBR(user.whatsapp) || '',
    username: '',
    role: 'supplier' as RoleKey,
    organizationName: user.organization_name ?? '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await updateUserInfo(user.id, {
        nome: form.nome,
        telefone: form.telefone,
        organizationName: form.organizationName || null,
      })

      if (res.error) {
        setError(res.error)
        return
      }

      router.push('/empresario/usuarios')
      router.refresh()
    })
  }

  return (
    <div className="max-w-lg space-y-6">
      <button
        onClick={() => router.push('/empresario/usuarios')}
        className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Editar usuário</h1>
        <p className="text-sm text-neutral-500 mt-1">Atualize nome, telefone e empresa do usuário.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-neutral-900 rounded-xl border border-white/[0.06] p-6"
      >
        <UserForm mode="edit" values={form} onChange={handleChange} />

        {error && (
          <p className="text-xs text-danger-400 bg-danger-500/10 border border-danger-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.push('/empresario/usuarios')}
            className="flex-1 px-4 py-2.5 text-sm text-neutral-400 border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isPending ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
