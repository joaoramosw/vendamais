/**
 * Normaliza um número de telefone brasileiro pra uso em links wa.me:
 * remove tudo que não é dígito, garante o prefixo do país (55).
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

/**
 * Valida o formato de um celular BR (DDD + 9 dígitos) depois de normalizado.
 * Não confirma que o número realmente tem WhatsApp — só o formato.
 */
export function isValidBrMobile(raw: string): boolean {
  return /^55\d{2}9\d{8}$/.test(normalizePhone(raw));
}

/**
 * Formato válido pra convite: DDD + 8 (fixo) ou DDD + 9 (celular). Mais
 * permissivo que `isValidBrMobile` de propósito — número de WhatsApp Business
 * de fornecedor costuma ser o fixo da empresa.
 */
export function isValidBrPhone(raw: string): boolean {
  return /^55\d{10,11}$/.test(normalizePhone(raw));
}

/**
 * Heurística para decidir se o que o usuário digitou num campo de busca é um
 * telefone (e não um nome): só dígitos e pontuação de telefone, com pelo
 * menos 8 dígitos (fixo sem DDD) e no máximo 13 (55 + DDD + 9 dígitos).
 */
export function looksLikePhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (!/^[\d\s().+-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

/** Formata um número BR pra exibição: (11) 91234-5678. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^55/, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
}

export interface ConviteCotacaoMessageParams {
  /** Nome do fornecedor/empresa convidada — abre a mensagem quando existe. */
  fornecedorNome?: string | null;
  cotacaoTitulo: string;
  /** Link público da proposta (`/proposta/<token>`) — omitido antes da cotação existir. */
  link?: string | null;
  totalItens?: number | null;
  dataLimite?: string | null;
}

function formatPrazo(dataLimite: string): string {
  const date = new Date(dataLimite);
  if (Number.isNaN(date.getTime())) return dataLimite;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Mensagem padrão de convite pra cotação, já formatada pro WhatsApp
 * (`*negrito*`) — nome do fornecedor, título da cotação, nº de itens, prazo e
 * o link do convite. Usada tanto no convite avulso quanto no reenvio a partir
 * dos chips de convidados.
 */
export function buildConviteCotacaoMessage({
  fornecedorNome,
  cotacaoTitulo,
  link,
  totalItens,
  dataLimite,
}: ConviteCotacaoMessageParams): string {
  const saudacao = fornecedorNome?.trim()
    ? `Olá, ${fornecedorNome.trim()}!`
    : "Olá!";

  const linhas = [
    saudacao,
    "",
    `Você está sendo convidado a enviar uma proposta para a cotação *${cotacaoTitulo}*.`,
  ];

  const detalhes: string[] = [];
  if (typeof totalItens === "number" && totalItens > 0) {
    detalhes.push(`${totalItens} ${totalItens === 1 ? "item" : "itens"} para cotar`);
  }
  if (dataLimite) {
    detalhes.push(`Prazo para envio: ${formatPrazo(dataLimite)}`);
  }
  if (detalhes.length > 0) {
    linhas.push("", ...detalhes);
  }

  if (link) {
    // O link agora exige conta (o fluxo de acesso pede login ou cadastro por
    // telefone antes de mostrar os preços) — a mensagem não pode mais
    // prometer "não precisa criar conta".
    linhas.push(
      "",
      "É só abrir o link abaixo, entrar com seu telefone e preencher seus preços:",
      link,
    );
  }

  linhas.push("", "Qualquer dúvida, é só responder por aqui. Obrigado!");

  return linhas.join("\n");
}

function buildWaMeUrl(message: string, phone?: string | null): string {
  const text = encodeURIComponent(message);
  if (phone && phone.trim()) {
    return `https://wa.me/${normalizePhone(phone)}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}

/** Número de suporte/atendimento da plataforma (WhatsApp). */
export const WHATSAPP_SUPPORT_NUMBER = "5571992567182";

/**
 * Monta um link `https://wa.me/<numero>?text=<mensagem>` — usado em links
 * estáticos de CTA (não precisa ser componente client).
 */
export function waMeUrl(
  message: string,
  phone: string = WHATSAPP_SUPPORT_NUMBER
): string {
  return buildWaMeUrl(message, phone);
}

/**
 * Envia uma mensagem via WhatsApp. Se `phone` for informado, abre o chat
 * direto com esse número. Se não, usa a Web Share API (no celular abre o
 * seletor nativo de apps — usuário escolhe WhatsApp e o contato manualmente)
 * com fallback pra `wa.me/?text=` (abre o WhatsApp com a mensagem pronta,
 * usuário escolhe o contato por lá).
 */
export async function shareViaWhatsApp(message: string, phone?: string | null): Promise<void> {
  if (!phone && typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text: message });
      return;
    } catch {
      // Usuário cancelou o share sheet ou o navegador rejeitou — cai pro link.
    }
  }

  window.open(buildWaMeUrl(message, phone), "_blank", "noopener,noreferrer");
}
