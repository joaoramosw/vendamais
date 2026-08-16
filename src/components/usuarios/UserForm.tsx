'use client'

import { ROLE_LABELS } from '@/lib/auth/permissions'
import { maskPhoneInput } from '@/lib/phone'
import type { RoleKey } from '@/lib/types/database'

const ROLE_OPTIONS: { value: RoleKey; label: string }[] = [
  { value: 'admin', label: ROLE_LABELS.admin },
  { value: 'supplier', label: ROLE_LABELS.supplier },
]

export interface UserFormValues {
  /** Identificador de login da conta (ver src/lib/phone.ts). */
  telefone: string
  nome: string
  username: string
  role: RoleKey
  organizationName: string
}

interface UserFormProps {
  mode: 'create' | 'edit'
  values: UserFormValues
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}

const inputClass =
  'w-full text-sm bg-white/[0.05] border border-white/[0.1] text-neutral-200 placeholder-neutral-600 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500/50'
const selectClass =
  'w-full text-sm bg-white/[0.05] border border-white/[0.1] text-neutral-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500/50 cursor-pointer'
const labelClass = 'block text-xs font-medium text-neutral-400 mb-1.5'

/**
 * Formulário de usuário (criar/editar). Não pede e-mail: a conta é
 * identificada pelo **telefone**, que é também com o que a pessoa faz login.
 * O e-mail sintético do Supabase Auth é gerado no servidor
 * (`createUserWithProvisionalPassword` / `updateUserInfo`) e nunca aparece
 * aqui.
 */
export function UserForm({ mode, values, onChange }: UserFormProps) {
  // A máscara é aplicada antes de repassar o evento — o pai continua com um
  // handler genérico por `name`, sem saber que este campo é especial.
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.target.value = maskPhoneInput(e.target.value)
    onChange(e)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Telefone *</label>
        <input
          type="tel"
          inputMode="numeric"
          name="telefone"
          required
          value={values.telefone}
          onChange={handlePhoneChange}
          placeholder="(11) 98765-4321"
          className={inputClass}
        />
        <p className="mt-1.5 text-[11px] text-neutral-500">
          É com este número que a pessoa entra na plataforma.
        </p>
      </div>
      <div>
        <label className={labelClass}>Nome completo *</label>
        <input
          type="text"
          name="nome"
          required
          value={values.nome}
          onChange={onChange}
          placeholder="Nome da pessoa"
          className={inputClass}
        />
      </div>

      {mode === 'create' && (
        <>
          <div>
            <label className={labelClass}>Nome de usuário *</label>
            <input
              type="text"
              name="username"
              required
              value={values.username}
              onChange={onChange}
              placeholder="usuario.nome"
              pattern="[a-zA-Z0-9_]+"
              title="Use apenas letras, números e underline."
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Papel *</label>
            <select name="role" value={values.role} onChange={onChange} className={selectClass}>
              {ROLE_OPTIONS.map(o => (
                <option key={o.value} value={o.value} className="bg-neutral-800">{o.label}</option>
              ))}
            </select>
          </div>
        </>
      )}
      <div>
        <label className={labelClass}>Empresa (opcional)</label>
        <input
          type="text"
          name="organizationName"
          value={values.organizationName}
          onChange={onChange}
          placeholder="Nome da empresa"
          className={inputClass}
        />
      </div>
    </div>
  )
}
