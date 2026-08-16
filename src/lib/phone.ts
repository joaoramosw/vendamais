/**
 * Telefone como identidade — normalização, exibição e e-mail sintético.
 *
 * Este é o módulo **puro** (sem I/O, testável sem mock) que sustenta a
 * autenticação por telefone. A camada com I/O vive em
 * `src/lib/auth/phone-auth.ts`; nada além dela deve montar um e-mail
 * sintético à mão.
 *
 * Regra do produto: o telefone é o único identificador exposto na UI. O
 * Supabase Auth continua sendo o dono da sessão (RLS/`auth.uid()` intactos),
 * então cada conta guarda internamente um endereço no domínio reservado
 * `phone.vendamais.local` — que **nunca** aparece na UI, em mensagem de erro
 * ou em log voltado ao usuário. Use `emailExibivel()` antes de mostrar
 * qualquer `users.email` na tela.
 *
 * ⚠️ Não confundir com `normalizePhone` de `src/lib/whatsapp.ts`: aquela é
 * tolerante (nunca lança) porque só monta link `wa.me`. Esta valida e lança —
 * é a que decide se um cadastro/login pode prosseguir.
 */

/** Domínio reservado (nunca roteável) dos e-mails sintéticos das contas. */
export const SYNTHETIC_EMAIL_DOMAIN = "phone.vendamais.local"

export class PhoneValidationError extends Error {
  constructor(message = "Informe um telefone válido com DDD (ex.: (71) 99999-9999).") {
    super(message)
    this.name = "PhoneValidationError"
  }
}

/** Só os dígitos do que o usuário digitou (aceita máscara, espaço, +55, ...). */
export function onlyDigits(input: string | null | undefined): string {
  return (input ?? "").replace(/\D/g, "")
}

/**
 * Forma canônica persistida em `users.whatsapp`: só dígitos, sempre com DDI.
 *
 * - 10–11 dígitos (DDD + número) → recebe o prefixo `55`.
 * - já começando com `55` e com 12–13 dígitos → mantém.
 * - qualquer outro tamanho → `PhoneValidationError`.
 *
 * Ex.: `(71) 99999-9999` → `5571999999999`.
 */
export function normalizePhone(input: string): string {
  const digits = onlyDigits(input)

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits
  }

  throw new PhoneValidationError()
}

/** Versão que não lança — para validação de formulário e casamento opcional. */
export function tryNormalizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  try {
    return normalizePhone(input)
  } catch {
    return null
  }
}

/** `true` quando o texto digitado vira um telefone válido. */
export function isValidPhone(input: string | null | undefined): boolean {
  return tryNormalizePhone(input) !== null
}

/**
 * Exibição na UI: `+55 (71) 99999-9999`. Aceita qualquer entrada — se não der
 * pra normalizar, devolve o texto original (nunca quebra uma tela).
 */
export function formatPhoneBR(input: string | null | undefined): string {
  const normalized = tryNormalizePhone(input)
  if (!normalized) return (input ?? "").trim()

  const ddi = normalized.slice(0, 2)
  const ddd = normalized.slice(2, 4)
  const resto = normalized.slice(4)

  const prefixo = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4)
  const sufixo = resto.length === 9 ? resto.slice(5) : resto.slice(4)

  return `+${ddi} (${ddd}) ${prefixo}-${sufixo}`
}

/**
 * Máscara progressiva para digitação: formata o que já foi digitado sem
 * exigir o número completo. Usada no `onChange` dos campos de telefone.
 */
export function maskPhoneInput(input: string): string {
  const digits = onlyDigits(input).replace(/^55/, "").slice(0, 11)

  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/**
 * E-mail sintético da conta. Helper **único** — toda chamada de auth
 * (signUp/signIn/admin.createUser) passa por aqui.
 */
export function phoneToSyntheticEmail(phone: string): string {
  return `${normalizePhone(phone)}@${SYNTHETIC_EMAIL_DOMAIN}`
}

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)
}

/** Telefone de volta a partir do e-mail sintético (`null` se não for um). */
export function phoneFromSyntheticEmail(email: string | null | undefined): string | null {
  if (!isSyntheticEmail(email)) return null
  return tryNormalizePhone(email!.split("@")[0])
}

/**
 * E-mail que pode ir pra tela: `null` quando é sintético (conta criada por
 * telefone). Espelha `emailExibivel` de `src/lib/convite-contato.ts`, que faz
 * o mesmo para a sentinela dos convites por WhatsApp.
 */
export function emailExibivel(email: string | null | undefined): string | null {
  return !email || isSyntheticEmail(email) ? null : email
}

/**
 * Identificação da conta pra UI: telefone formatado quando existe, senão o
 * e-mail real, senão vazio. Nunca devolve e-mail sintético.
 */
export function identificadorExibivel(
  telefone: string | null | undefined,
  email: string | null | undefined,
): string {
  if (telefone) return formatPhoneBR(telefone)
  const phoneDoEmail = phoneFromSyntheticEmail(email)
  if (phoneDoEmail) return formatPhoneBR(phoneDoEmail)
  return emailExibivel(email) ?? ""
}
