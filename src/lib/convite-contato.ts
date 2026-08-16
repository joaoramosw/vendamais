/**
 * Espelho de `backend/src/cotacoes/convite-contato.util.ts` para os poucos
 * caminhos que ainda leem `fornecedores_convidados` direto do Supabase (sem
 * passar pelo backend, que já traduz a sentinela).
 *
 * `email_contato` é NOT NULL no banco real, então convite só por WhatsApp
 * grava um endereço-sentinela no domínio reservado `whatsapp.invalid` — que
 * nunca deve aparecer na UI.
 */
const PLACEHOLDER_DOMAIN = "whatsapp.invalid";

/** E-mail sintético das contas criadas por telefone — ver `src/lib/phone.ts`. */
const SYNTHETIC_ACCOUNT_DOMAIN = "phone.vendamais.local";

export function isEmailSentinela(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalizado = email.toLowerCase();
  return (
    normalizado.endsWith(`@${PLACEHOLDER_DOMAIN}`) ||
    normalizado.endsWith(`@${SYNTHETIC_ACCOUNT_DOMAIN}`)
  );
}

/** E-mail exibível, ou `null` quando é só a sentinela do convite por WhatsApp. */
export function emailExibivel(email: string | null | undefined): string | null {
  return !email || isEmailSentinela(email) ? null : email;
}
