/**
 * phone-auth.ts — camada de autenticação por telefone (server-only).
 *
 * Complementa o módulo puro `src/lib/phone.ts` (normalização + e-mail
 * sintético) com o I/O: Supabase Auth, tabela `users` e sessão por cookie.
 * Nenhuma tela toca em `signInWithPassword`/`admin.createUser` diretamente —
 * tudo passa por aqui.
 *
 * Princípio (Opção 3 da refatoração): o Supabase Auth continua nativo, então
 * RLS/`auth.uid()`/sessão seguem valendo. O telefone é o único identificador
 * exposto; o e-mail é um detalhe interno, sintético e não roteável.
 *
 * ⚠️ Segurança: a service-role key só é usada aqui dentro, e este módulo é
 * importado exclusivamente por Server Actions/Route Handlers. Ele importa
 * `@/lib/supabase/server` (que usa `next/headers`), o que faz o build do Next
 * falhar se algum componente client tentar importá-lo — é a trava que garante
 * que a chave nunca vai pro bundle do navegador.
 *
 * Contas legadas: usuário criado antes desta refatoração tem `users.email`
 * real (não sintético). Por isso o login resolve o e-mail de autenticação a
 * partir da linha em `users` (`resolveAuthEmail`) em vez de assumir o
 * sintético — assim basta preencher `users.whatsapp` (pela tela de usuários ou
 * por `scripts/definir-telefone-usuario.mjs`) para a conta antiga passar a
 * entrar por telefone, sem migrar e-mail nenhum.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { mapAuthError } from '@/lib/auth/error-messages'
import { normalizePhone, phoneToSyntheticEmail, PhoneValidationError } from '@/lib/phone'
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy'
import type { RoleKey } from '@/lib/types/database'

export { MIN_PASSWORD_LENGTH }

export type PhoneAuthErrorTarget = 'telefone' | 'password' | 'passwordConfirm' | 'nome' | 'general'

export interface PhoneAuthError {
  error: string
  target: PhoneAuthErrorTarget
}

export interface PhoneAuthSuccess {
  userId: string
  role: RoleKey
  telefone: string
}

export type PhoneAuthResult = PhoneAuthSuccess | PhoneAuthError

export function isPhoneAuthError(result: PhoneAuthResult): result is PhoneAuthError {
  return 'error' in result
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normaliza o telefone convertendo a exceção em erro de formulário — nenhuma
 * tela precisa de try/catch em volta de `normalizePhone`.
 */
function parsePhone(input: string): { telefone: string } | PhoneAuthError {
  try {
    return { telefone: normalizePhone(input) }
  } catch (error) {
    if (error instanceof PhoneValidationError) {
      return { error: error.message, target: 'telefone' }
    }
    return { error: 'Informe um telefone válido com DDD.', target: 'telefone' }
  }
}

interface UsuarioPorTelefone {
  id: string
  email: string
  nome: string
  role: RoleKey
}

/**
 * Conta ativa dona deste telefone. Usa a service role de propósito: a consulta
 * acontece **antes** de existir sessão (RLS de `users` recusaria a leitura
 * anônima — confirmado ao vivo, a anon key devolve 0 linhas).
 */
async function findUserByPhone(telefone: string): Promise<UsuarioPorTelefone | null> {
  const adminClient = createAdminClient()

  const { data } = await adminClient
    .from('users')
    .select('id, email, nome, roles(key)')
    .eq('whatsapp', telefone)
    .is('deleted_at', null)
    .maybeSingle()

  if (!data) return null

  const roleKey = (data as unknown as { roles: { key: string } | null }).roles?.key
  return {
    id: data.id,
    email: data.email,
    nome: data.nome,
    role: roleKey === 'admin' ? 'admin' : 'supplier',
  }
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * Existe conta com este telefone? Checagem pela tabela de perfil (`users`),
 * não pelo Auth — é lá que o telefone é a chave de negócio.
 */
export async function phoneExists(phone: string): Promise<boolean> {
  const parsed = parsePhone(phone)
  if ('error' in parsed) return false
  return (await findUserByPhone(parsed.telefone)) !== null
}

/**
 * Login por telefone + senha. Cria a sessão (cookies) via client SSR.
 *
 * O Supabase devolve o mesmo "invalid login credentials" para conta
 * inexistente e senha errada; aqui a distinção é feita depois da falha,
 * consultando `users` — mesma estratégia do login por e-mail anterior.
 */
export async function signInWithPhone(input: {
  phone: string
  password: string
}): Promise<PhoneAuthResult> {
  const parsed = parsePhone(input.phone)
  if ('error' in parsed) return parsed

  if (!input.password) {
    return { error: 'Informe sua senha.', target: 'password' }
  }

  const { telefone } = parsed
  const usuario = await findUserByPhone(telefone)
  const email = usuario?.email ?? phoneToSyntheticEmail(telefone)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password })

  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      if (!usuario) {
        return {
          error: 'Telefone não encontrado. Verifique o número ou crie sua conta.',
          target: 'telefone',
        }
      }
      return { error: 'Senha incorreta. Tente novamente.', target: 'password' }
    }
    return { error: mapAuthError(error.message), target: 'general' }
  }

  if (!data.user) {
    return { error: mapAuthError(null), target: 'general' }
  }

  return {
    userId: data.user.id,
    role: usuario?.role ?? 'supplier',
    telefone,
  }
}

/**
 * Cadastro por telefone: cria a conta no Supabase Auth (Admin API,
 * `email_confirm: true` para dispensar confirmação de e-mail), grava o perfil
 * em `users` e já deixa a pessoa logada.
 *
 * Não é transacional no banco, mas compensa: se o `users` falhar, a conta de
 * Auth recém-criada é removida — senão sobraria um login fantasma que impede
 * o recadastro do mesmo número.
 */
export async function signUpWithPhone(input: {
  phone: string
  password: string
  passwordConfirm?: string
  nome: string
  nomeEmpresa?: string | null
  role?: RoleKey
}): Promise<PhoneAuthResult> {
  const parsed = parsePhone(input.phone)
  if ('error' in parsed) return parsed
  const { telefone } = parsed

  const nome = input.nome?.trim() ?? ''
  if (nome.length < 3) {
    return { error: 'Informe seu nome completo.', target: 'nome' }
  }

  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`,
      target: 'password',
    }
  }

  if (input.passwordConfirm !== undefined && input.password !== input.passwordConfirm) {
    return { error: 'As senhas não coincidem.', target: 'passwordConfirm' }
  }

  if (await phoneExists(telefone)) {
    return {
      error: 'Já existe uma conta com este telefone. Faça login.',
      target: 'telefone',
    }
  }

  const role: RoleKey = input.role ?? 'supplier'
  const adminClient = createAdminClient()

  const { data: roleRow } = await adminClient
    .from('roles')
    .select('id')
    .eq('key', role)
    .maybeSingle()

  if (!roleRow) {
    return { error: 'Não foi possível concluir o cadastro (papel inválido).', target: 'general' }
  }

  const email = phoneToSyntheticEmail(telefone)

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      phone_digits: telefone,
      nome,
      nome_empresa: input.nomeEmpresa?.trim() || null,
      role,
    },
  })

  if (authError || !authData?.user) {
    // "already registered" aqui significa conta de Auth órfã (sem linha em
    // `users`) — phoneExists não a encontraria. Mensagem em termos de
    // telefone: o e-mail sintético nunca é mencionado ao usuário.
    if (authError && /already registered|already been registered/i.test(authError.message)) {
      return {
        error: 'Já existe uma conta com este telefone. Faça login.',
        target: 'telefone',
      }
    }
    return { error: mapAuthError(authError?.message), target: 'general' }
  }

  const userId = authData.user.id

  const { error: userError } = await adminClient.from('users').upsert(
    {
      id: userId,
      nome,
      email,
      whatsapp: telefone,
      role_id: roleRow.id,
      organization_name: input.nomeEmpresa?.trim() || null,
      must_change_password: false,
    },
    { onConflict: 'id' },
  )

  if (userError) {
    await adminClient.auth.admin.deleteUser(userId)
    // Corrida com outro cadastro do mesmo número: o índice único da migration
    // 022 é quem barra, e a mensagem tem que continuar falando de telefone.
    if (/duplicate key|unique constraint/i.test(userError.message)) {
      return { error: 'Já existe uma conta com este telefone. Faça login.', target: 'telefone' }
    }
    return { error: userError.message, target: 'general' }
  }

  // Cadastro já entra logado (requisito do fluxo de acesso via link).
  const supabase = await createClient()
  const { error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  })

  if (sessionError) {
    return { error: mapAuthError(sessionError.message), target: 'general' }
  }

  return { userId, role, telefone }
}

/**
 * Reautenticação para confirmar uma ação sensível (o passo de senha antes de
 * enviar a proposta). Valida a senha do **usuário logado** sem tocar na sessão
 * atual: usa um client isolado, com `persistSession: false`, então nenhum
 * cookie é reescrito e um erro de digitação não desloga ninguém.
 */
export async function verifyCurrentUserPassword(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!password) {
    return { ok: false, error: 'Informe sua senha para confirmar.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { ok: false, error: 'Sessão expirada. Entre novamente para continuar.' }
  }

  const isolated = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { error } = await isolated.auth.signInWithPassword({ email: user.email, password })

  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      return { ok: false, error: 'Senha incorreta. Tente novamente.' }
    }
    return { ok: false, error: mapAuthError(error.message) }
  }

  // Sessão paralela criada só pra validar a senha — revogada em seguida para
  // não deixar refresh token solto.
  await isolated.auth.signOut()

  return { ok: true }
}

/** Telefone da conta logada (para pré-preencher a confirmação de senha). */
export async function getCurrentUserPhone(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('users')
    .select('whatsapp')
    .eq('id', user.id)
    .maybeSingle()

  return data?.whatsapp ?? null
}
