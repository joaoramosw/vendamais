const FALLBACK = 'Não foi possível concluir. Tente novamente.'

/**
 * A identidade exposta ao usuário é o **telefone** — nunca o e-mail sintético
 * que o Supabase Auth guarda por baixo (ver src/lib/phone.ts). Por isso as
 * mensagens abaixo falam de telefone mesmo quando o erro original do provedor
 * fala de e-mail.
 */
const KNOWN_MESSAGES: Array<{ match: RegExp; message: string }> = [
  { match: /invalid login credentials/i, message: 'Telefone ou senha incorretos.' },
  { match: /email not confirmed/i, message: 'Conta ainda não confirmada. Fale com o suporte.' },
  { match: /rate limit/i, message: 'Muitas tentativas. Aguarde um momento e tente novamente.' },
  { match: /user already registered/i, message: 'Já existe uma conta com este telefone.' },
  { match: /password should be at least/i, message: 'A senha deve ter no mínimo 6 caracteres.' },
  { match: /unable to validate email address/i, message: 'Telefone inválido.' },
]

/**
 * Traduz mensagens de erro do Supabase Auth (em inglês, e às vezes
 * deliberadamente genéricas por segurança) para respostas padronizadas em
 * pt-BR. Mensagens não mapeadas caem no fallback genérico em vez de
 * repassar o texto bruto do provedor.
 */
export function mapAuthError(message: string | null | undefined): string {
  if (!message) return FALLBACK
  const found = KNOWN_MESSAGES.find((entry) => entry.match.test(message))
  return found?.message ?? FALLBACK
}
