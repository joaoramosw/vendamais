"use client"

import { signUp, type AuthFieldError } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { FormError, PhoneField, TextField } from "@/components/auth/auth-fields"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy"
import { useRouter } from "next/navigation"
import { useState } from "react"

type FieldErrors = Partial<Record<AuthFieldError["target"], string>>

interface CadastroFormProps {
  /** Para onde ir depois de criar a conta (já logado). */
  redirectTo?: string
  /** Quando informado, não navega — ver `LoginForm`. */
  onAuthenticated?: () => void
  submitLabel?: string
}

export function CadastroForm({
  redirectTo = "",
  onAuthenticated,
  submitLabel = "Criar conta",
}: CadastroFormProps) {
  const router = useRouter()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nome: "",
    nomeEmpresa: "",
    telefone: "",
    password: "",
    passwordConfirm: "",
  })

  const set = (campo: keyof typeof form) => (valor: string) =>
    setForm((prev) => ({ ...prev, [campo]: valor }))

  async function handleSubmit(formData: FormData) {
    setErrors({})

    // Espelha as regras do servidor pra dar o retorno antes do round-trip —
    // a validação que vale continua sendo a de signUpWithPhone.
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setErrors({ password: `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.` })
      return
    }
    if (form.password !== form.passwordConfirm) {
      setErrors({ passwordConfirm: "As senhas não coincidem." })
      return
    }

    setLoading(true)
    const result = await signUp(formData)

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

      <TextField
        id="nome"
        name="nome"
        label="Nome"
        value={form.nome}
        onChange={set("nome")}
        error={errors.nome}
        disabled={loading}
        autoFocus
        autoComplete="name"
        placeholder="Seu nome completo"
      />

      <TextField
        id="nomeEmpresa"
        name="nomeEmpresa"
        label="Nome da empresa"
        value={form.nomeEmpresa}
        onChange={set("nomeEmpresa")}
        disabled={loading}
        autoComplete="organization"
        placeholder="Nome da sua empresa"
      />

      <PhoneField
        id="telefone"
        name="telefone"
        label="Telefone"
        value={form.telefone}
        onChange={set("telefone")}
        error={errors.telefone}
        disabled={loading}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField
          id="password"
          name="password"
          label="Senha"
          type="password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          disabled={loading}
          autoComplete="new-password"
          placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
        />
        <TextField
          id="passwordConfirm"
          name="passwordConfirm"
          label="Confirme a senha"
          type="password"
          value={form.passwordConfirm}
          onChange={set("passwordConfirm")}
          error={errors.passwordConfirm}
          disabled={loading}
          autoComplete="new-password"
          placeholder="Repita a senha"
        />
      </div>

      <Button type="submit" loading={loading} loadingText="Criando conta..." className="w-full">
        {submitLabel}
      </Button>
    </form>
  )
}
