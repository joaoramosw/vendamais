"use client"

/**
 * Campos compartilhados das telas de auth (login, cadastro e o gate de acesso
 * do link da proposta). Um lugar só para o visual e, principalmente, para o
 * comportamento do campo de telefone — que é o identificador do sistema e
 * precisa se comportar igual em todas as portas de entrada.
 */

import { maskPhoneInput } from "@/lib/phone"
import { cn } from "@/lib/utils"

export const authInputClass =
  "w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-[var(--radius-md)] text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all disabled:opacity-50"

export const authLabelClass =
  "block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"

export function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return <p className="mt-1.5 text-xs text-danger-600 dark:text-danger-400">{children}</p>
}

interface FieldBaseProps {
  id: string
  name: string
  label: string
  error?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  placeholder?: string
  autoComplete?: string
  hint?: string
}

/**
 * Campo de telefone com máscara progressiva. O valor exibido é mascarado
 * `(71) 99999-9999`; o servidor normaliza para `5571999999999`
 * (`normalizePhone`), então não há problema em mandar a máscara no FormData.
 */
export function PhoneField({
  value,
  onChange,
  hint = "É com ele que você entra na plataforma.",
  ...props
}: FieldBaseProps & { value: string; onChange: (value: string) => void }) {
  const { id, name, label, error, disabled, required = true, autoFocus, autoComplete = "tel" } = props

  return (
    <div>
      <label htmlFor={id} className={authLabelClass}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(maskPhoneInput(e.target.value))}
        aria-invalid={Boolean(error)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={authInputClass}
        placeholder="(71) 99999-9999"
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
      <FieldError>{error}</FieldError>
    </div>
  )
}

export function TextField({
  value,
  onChange,
  type = "text",
  ...props
}: FieldBaseProps & {
  value: string
  onChange: (value: string) => void
  type?: "text" | "password"
}) {
  const {
    id,
    name,
    label,
    error,
    disabled,
    required = true,
    autoFocus,
    placeholder,
    autoComplete,
    hint,
  } = props

  return (
    <div>
      <label htmlFor={id} className={authLabelClass}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={cn(authInputClass)}
      />
      {hint && !error && (
        <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
      )}
      <FieldError>{error}</FieldError>
    </div>
  )
}

export function FormError({ children }: { children?: string | null }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="bg-danger-light text-danger text-sm rounded-[var(--radius-md)] p-3 mb-4 border border-danger-200"
    >
      {children}
    </div>
  )
}
