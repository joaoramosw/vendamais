/**
 * Rotas canônicas do app — fonte única para "onde cada papel cai ao entrar" e
 * para o link público da proposta.
 *
 * Existe porque esses dois caminhos estavam repetidos em cinco lugares
 * (middleware, action de login, troca de senha, index do fornecedor, sidebar)
 * e um deles sempre ficava para trás quando o destino mudava.
 */

import type { RoleKey } from '@/lib/types/database'

/**
 * Landing do fornecedor: **Cotações Ativas**.
 *
 * O Dashboard do fornecedor está desativado (ver
 * `FORNECEDOR_DASHBOARD_HABILITADO`) — o código continua no repositório, só
 * não é mais alcançável.
 */
export const FORNECEDOR_LANDING_PATH = '/fornecedor/cotacoes'

export const EMPRESARIO_LANDING_PATH = '/empresario/dashboard'

/**
 * Chave para religar o Dashboard do fornecedor. Enquanto for `false`, a rota
 * `/fornecedor/dashboard` redireciona para a landing e o item some da sidebar.
 * Nada foi deletado: virar para `true` devolve a tela inteira.
 */
export const FORNECEDOR_DASHBOARD_HABILITADO = false

export function landingPathForRole(role: RoleKey): string {
  return role === 'admin' ? EMPRESARIO_LANDING_PATH : FORNECEDOR_LANDING_PATH
}

/**
 * Link público da proposta — slug canônico `/proposta/` (singular).
 *
 * O identificador aceito é o token do convite **ou** o id da proposta já
 * enviada; a rota resolve os dois (ver `src/app/proposta/[id]/page.tsx`).
 * Toda geração de link passa por aqui para não voltar a existir variação
 * (`/propostas/`, `/propost/`) espalhada pelo código.
 */
export function propostaPath(identificador: string): string {
  return `/proposta/${identificador}`
}

/** Mesma rota, absoluta — para mensagens de WhatsApp e cópia de link. */
export function propostaUrl(identificador: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}${propostaPath(identificador)}`
}
