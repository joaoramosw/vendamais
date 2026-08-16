/**
 * Política de senha — puro, sem I/O, importável tanto do cliente quanto do
 * servidor.
 *
 * Mora fora de `phone-auth.ts` de propósito: aquele módulo importa a service
 * role e `next/headers`, então um componente client que precisasse só do
 * mínimo de caracteres arrastaria o servidor inteiro (e a chave) pro bundle.
 */

/** Mínimo exigido no cadastro por telefone (decisão do produto). */
export const MIN_PASSWORD_LENGTH = 6

export function senhaAtendeMinimo(senha: string): boolean {
  return senha.length >= MIN_PASSWORD_LENGTH
}
