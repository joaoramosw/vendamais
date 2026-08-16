"use client"

import { signIn, type AuthFieldError } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { FormError, PhoneField, TextField } from "@/components/auth/auth-fields"
import { useRouter } from "next/navigation"
import { useState } from "react"

type FieldErrors = Partial<Record<AuthFieldError["target"], string>>

interface LoginFormProps {
  /** Para onde ir depois de entrar. Vazio = destino do papel (servidor decide). */
  redirectTo?: string
  /**
   * Quando informado, o formulário **não navega**: só avisa quem o embutiu.
   * É o caso do gate do link da proposta, que apenas recarrega a rota atual
   * agora que existe sessão.
   */
  onAuthenticated?: () => void
  submitLabel?: string
}

export function LoginForm({ redirectTo = "", onAuthenticated, submitLabel = "Entrar" }: LoginFormProps) {
  const router = useRouter()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [telefone, setTelefone] = useState("")
  const [senha, setSenha] = useState("")

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setErrors({})

    const result = await signIn(formData)

    if ("error" in result) {
      setErrors({ [result.target]: result.error })
      setLoading(false)
      return
    }

    if (onAuthenticated) {
      onAuthenticated()
      return
    }

    router.push(result.redirectTo)
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="redirect" value={redirectTo} />

      <FormError>{errors.general}</FormError>

      <PhoneField
        id="telefone"
        name="telefone"
        label="Telefone"
        value={telefone}
        onChange={setTelefone}
        error={errors.telefone}
        disabled={loading}
        autoFocus
        hint=""
      />

      <TextField
        id="password"
        name="password"
        label="Senha"
        type="password"
        value={senha}
        onChange={setSenha}
        error={errors.password}
        disabled={loading}
        autoComplete="current-password"
        placeholder="••••••••"
      />

      <Button type="submit" loading={loading} loadingText="Entrando..." className="w-full">
        {submitLabel}
      </Button>
    </form>
  )
}
