'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { landingPathForRole } from '@/lib/routes'
import {
  isPhoneAuthError,
  MIN_PASSWORD_LENGTH,
  signInWithPhone,
  signUpWithPhone,
  verifyCurrentUserPassword,
  type PhoneAuthErrorTarget,
} from '@/lib/auth/phone-auth'

export interface AuthFieldError {
  error: string
  target: PhoneAuthErrorTarget
}

export interface AuthOk {
  ok: true
  /** Destino calculado no servidor (papel do usuário ou `?redirect=`). */
  redirectTo: string
}

export type AuthResult = AuthOk | AuthFieldError

/**
 * Login por **telefone + senha**. Não existe mais campo de e-mail em nenhuma
 * tela de auth — o e-mail sintético que o Supabase Auth guarda por baixo é
 * detalhe interno (ver src/lib/phone.ts e src/lib/auth/phone-auth.ts).
 *
 * Devolve o destino em vez de redirecionar: o mesmo formulário é usado como
 * página (`/login`, que navega) e embutido no gate do link da proposta (que só
 * precisa recarregar a rota atual, já logado).
 */
export async function signIn(formData: FormData): Promise<AuthResult> {
  const telefone = ((formData.get('telefone') as string) || '').trim()
  const password = (formData.get('password') as string) || ''
  const redirectTo = (formData.get('redirect') as string) || ''

  if (!telefone || !password) {
    return { error: 'Preencha telefone e senha.', target: 'general' }
  }

  let result
  try {
    result = await signInWithPhone({ phone: telefone, password })
  } catch {
    return { error: 'Não foi possível entrar. Tente novamente.', target: 'general' }
  }

  if (isPhoneAuthError(result)) {
    return result
  }

  return { ok: true, redirectTo: safeRedirect(redirectTo) ?? landingPathForRole(result.role) }
}

/**
 * Cadastro por telefone (papel fornecedor). Campos: nome, nome da empresa,
 * telefone, senha + confirmação. Sai já logado — usado tanto pela tela
 * `/cadastro` quanto pelo gate de acesso do link da proposta.
 */
export async function signUp(formData: FormData): Promise<AuthResult> {
  const nome = ((formData.get('nome') as string) || '').trim()
  const nomeEmpresa = ((formData.get('nomeEmpresa') as string) || '').trim()
  const telefone = ((formData.get('telefone') as string) || '').trim()
  const password = (formData.get('password') as string) || ''
  const passwordConfirm = (formData.get('passwordConfirm') as string) || ''
  const redirectTo = (formData.get('redirect') as string) || ''

  let result
  try {
    result = await signUpWithPhone({
      phone: telefone,
      password,
      passwordConfirm,
      nome,
      nomeEmpresa,
      role: 'supplier',
    })
  } catch {
    return { error: 'Não foi possível criar sua conta. Tente novamente.', target: 'general' }
  }

  if (isPhoneAuthError(result)) {
    return result
  }

  return { ok: true, redirectTo: safeRedirect(redirectTo) ?? landingPathForRole(result.role) }
}

/**
 * Confirmação de senha antes de uma ação sensível (o passo final do envio da
 * proposta). Não mexe na sessão atual — ver `verifyCurrentUserPassword`.
 */
export async function confirmarSenha(
  password: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const result = await verifyCurrentUserPassword(password)
    return result.ok ? { ok: true, error: null } : { ok: false, error: result.error }
  } catch {
    return { ok: false, error: 'Não foi possível validar sua senha. Tente novamente.' }
  }
}

/**
 * Só aceita redirect relativo (começando com "/" mas não "//", que o navegador
 * trata como protocol-relative) pra não virar open redirect.
 */
function safeRedirect(path: string): string | null {
  return path.startsWith('/') && !path.startsWith('//') ? path : null
}

export async function signOut() {
  const supabase = await createClient()

  // supabase.auth.signOut() faz uma chamada de rede para revogar o token no
  // servidor do Supabase ANTES de limpar a sessão local — se essa chamada
  // falhar (offline, timeout, token já expirado), a limpeza local nunca
  // acontece e o cookie de sessão continua válido, fazendo o middleware
  // reconhecer o usuário como autenticado em /login e mandá-lo de volta pro
  // dashboard. Por isso limpamos os cookies `sb-*` manualmente aqui, sem
  // depender do resultado dessa chamada.
  try {
    await supabase.auth.signOut()
  } catch (error) {
    console.error('[signOut] falha ao revogar sessão no Supabase:', error)
  } finally {
    const cookieStore = await cookies()
    cookieStore.getAll().forEach(({ name }) => {
      if (name.startsWith('sb-')) {
        cookieStore.delete(name)
      }
    })
  }

  redirect('/login')
}

/**
 * Sets a new password for the current session and clears the
 * `must_change_password` flag — used after an admin creates a user with a
 * system-generated provisional password (see `createUserWithProvisionalPassword`).
 */
export async function updatePasswordAndClearMustChangeFlag(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const password = formData.get('password') as string
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { error: `A senha deve ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.` }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    return { error: updateError.message }
  }

  const { error: userError } = await supabase
    .from('users')
    .update({ must_change_password: false })
    .eq('id', user.id)

  if (userError) {
    return { error: userError.message }
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role:roles(key)')
    .eq('id', user.id)
    .single()

  const roleKey = (userRow as unknown as { role: { key: string } | null })?.role?.key
  redirect(landingPathForRole(roleKey === 'admin' ? 'admin' : 'supplier'))
}
