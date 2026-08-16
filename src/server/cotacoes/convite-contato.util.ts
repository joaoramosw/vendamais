/**
 * Contato do convite — e o `email_contato` NOT NULL do banco real.
 *
 * `fornecedores_convidados.email_contato` é NOT NULL e sem default no banco
 * de produção (confirmado ao vivo pelo schema OpenAPI do PostgREST), mas o
 * convite por WhatsApp não tem e-mail nenhum: inserir `null` devolve
 * `null value in column "email_contato" ... violates not-null constraint` e
 * derruba o convite inteiro. Sem acesso a DDL por aqui, o convite só por
 * número grava um endereço-sentinela derivado do próprio telefone, no domínio
 * reservado `.invalid` (RFC 2606 — nunca resolve, nunca é entregável, não
 * colide com e-mail de ninguém), e toda leitura o traduz de volta pra `null`
 * antes de sair da API.
 *
 * Pra remover o remendo: `ALTER TABLE fornecedores_convidados ALTER COLUMN
 * email_contato DROP NOT NULL` e apagar este arquivo.
 */
const PLACEHOLDER_DOMAIN = 'whatsapp.invalid';

/**
 * Domínio dos e-mails sintéticos das **contas** (autenticação por telefone —
 * ver src/lib/phone.ts no front). Não é gravado em `email_contato` de
 * propósito, mas entra aqui como sentinela também: se algum caminho novo
 * copiar o e-mail da conta pro convite, ele continua invisível na UI em vez de
 * aparecer como se fosse um endereço de verdade.
 */
const SYNTHETIC_ACCOUNT_DOMAIN = 'phone.vendamais.local';

/** Sentinela de e-mail pra um convite que só tem WhatsApp. */
export function emailSentinelaParaWhatsapp(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, '');
  return `${digits || 'sem-numero'}@${PLACEHOLDER_DOMAIN}`;
}

export function isEmailSentinela(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalizado = email.toLowerCase();
  return (
    normalizado.endsWith(`@${PLACEHOLDER_DOMAIN}`) ||
    normalizado.endsWith(`@${SYNTHETIC_ACCOUNT_DOMAIN}`)
  );
}

/** Traduz a sentinela de volta pra `null` — use em toda saída da API. */
export function semSentinela<T extends { email_contato: string | null }>(row: T): T {
  return isEmailSentinela(row.email_contato) ? { ...row, email_contato: null } : row;
}

/** Só dígitos, pra comparar telefones gravados em formatos diferentes. */
export function digitosDoTelefone(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

/**
 * Forma canônica do WhatsApp gravada em `fornecedores_convidados`: só dígitos,
 * com o código do país (55). Sem isso o mesmo número entra como
 * "(11) 91234-5678" pelo modal de convite e "11912345678" pela busca, e o
 * casamento por telefone (dedupe do convite, "Cotações Ativas" do fornecedor)
 * passa reto. Espelha `normalizePhone` de `src/lib/whatsapp.ts`.
 */
export function normalizarWhatsapp(raw: string | null | undefined): string | null {
  const digits = digitosDoTelefone(raw);
  if (!digits) return null;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}
