'use client'

import { updateOwnProfile, type OwnProfile } from '@/actions/profiles'
import { formatPhoneBR, maskPhoneInput } from '@/lib/phone'
import { Loader2, Save } from 'lucide-react'
import { useState, useTransition } from 'react'

interface OwnProfileFormProps {
  profile: OwnProfile
}

const inputClass =
  'w-full text-sm bg-white/[0.05] border border-white/[0.1] text-neutral-200 placeholder-neutral-600 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500/50'
const labelClass = 'block text-xs font-medium text-neutral-400 mb-1.5'

export function OwnProfileForm({ profile }: OwnProfileFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    nome: profile.nome,
    organizationName: profile.organization_name ?? '',
    telefone: formatPhoneBR(profile.whatsapp) || '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.name === 'telefone' ? maskPhoneInput(e.target.value) : e.target.value
    setForm((prev) => ({ ...prev, [e.target.name]: valor }))
    setSuccess(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await updateOwnProfile({
        nome: form.nome,
        telefone: form.telefone,
        organizationName: form.organizationName || undefined,
      })

      if (res.error) {
        setError(res.error)
        return
      }

      setSuccess(true)
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/[0.06] bg-neutral-800 p-6 lg:p-8 space-y-6 max-w-lg"
    >
      <h2 className="text-lg font-bold text-white">Dados do Perfil</h2>

      <div className="space-y-4">
        <div>
          <label className={labelClass}>Nome *</label>
          <input
            type="text"
            name="nome"
            required
            value={form.nome}
            onChange={handleChange}
            placeholder="Nome completo"
            className={inputClass}
          />
        </div>

        {/* Sem campo de e-mail: a conta é identificada pelo telefone, e o
            endereço que o Supabase Auth guarda é sintético (src/lib/phone.ts). */}
        <div>
          <label className={labelClass}>Telefone *</label>
          <input
            type="tel"
            inputMode="numeric"
            name="telefone"
            required
            value={form.telefone}
            onChange={handleChange}
            placeholder="(11) 98765-4321"
            className={inputClass}
          />
          <p className="mt-1.5 text-[11px] text-neutral-500">
            É com este número que você entra na plataforma e que os compradores te encontram.
          </p>
        </div>

        <div>
          <label className={labelClass}>Empresa</label>
          <input
            type="text"
            name="organizationName"
            value={form.organizationName}
            onChange={handleChange}
            placeholder="Nome da empresa"
            className={inputClass}
          />
        </div>

      </div>

      {error && (
        <p className="text-xs text-danger-400 bg-danger-500/10 border border-danger-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-success-400 bg-success-500/10 border border-success-500/20 rounded-lg px-3 py-2">
          Dados atualizados com sucesso.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  )
}
