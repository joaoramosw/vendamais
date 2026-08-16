import { type ClassValue, clsx } from "clsx";

/**
 * Merge Tailwind classes with clsx for conditional class composition.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format currency to BRL.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Format a Date to 'dd/mm/yyyy'.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

/**
 * Format a Date to relative time (e.g. '2 dias atrás').
 */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`;
  return formatDate(d);
}

/**
 * Truncate a string to a maximum length.
 */
/**
 * Format a Date to 'dd/mm/yyyy HH:mm'.
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

// ─── Utilitários de preço estilo maquininha ──────────────────────────────────

/**
 * Converte um número decimal (do banco) em centavos inteiros.
 * Ex: 12.50 → 1250
 */
export function decimalToCents(decimal: number | null | undefined): number {
  if (decimal == null || isNaN(decimal)) return 0;
  return Math.round(decimal * 100);
}

/**
 * Converte centavos inteiros em decimal para salvar no banco.
 * Ex: 1250 → 12.50
 */
export function centsToDecimal(cents: number): number {
  return cents / 100;
}

/**
 * Formata centavos inteiros como string no formato brasileiro.
 * Ex: 1250 → "R$\u00a012,50"
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Handler de onChange para campos de preço estilo maquininha.
 * Recebe o valor digitado (string), retorna o novo estado em centavos.
 *
 * Uso:
 *   const [cents, setCents] = useState(0)
 *   <input value={formatCents(cents)} onChange={e => setCents(handleCentsInput(e.target.value))} />
 */
export function handleCentsInput(rawValue: string): number {
  // Remove tudo que não for dígito
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return 0;
  // Limita a 10 dígitos (R$ 99.999.999,99)
  const clamped = digits.slice(-10);
  return parseInt(clamped, 10);
}
